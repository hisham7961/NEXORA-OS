import { prisma } from "@/lib/db";
import { logger } from "@/lib/log";
import { cronMatches, nextRun } from "./cron";
import { JOB_DEFINITIONS, jobByName, type JobDefinition } from "./registry";

/**
 * Job scheduler (§10, §37-38). Next.js `instrumentation.ts` calls `startScheduler()`
 * once at server startup; a minute-aligned interval then fires any job whose cron
 * matches the current minute. Every run is recorded in BackgroundJobRun (history,
 * duration, error) and reflected on the job's BackgroundJob row, so the Admin
 * Operations Center shows real state — nothing runs invisibly. Runners are idempotent.
 *
 * Multi-instance safety: before a SCHEDULED run, the instance claims a unique
 * (jobName, minute) row in JobRunClaim. The DB unique constraint means only one
 * instance's claim succeeds, so a job fires exactly once per minute across the whole
 * fleet even when several app servers tick simultaneously. Manual "run now" is
 * intentional and does not claim.
 */

interface SchedulerState {
  started: boolean;
  timer: ReturnType<typeof setInterval> | null;
  running: Set<string>;
  lastTickAt: Date | null;
}

const g = globalThis as unknown as { __nexoraScheduler?: SchedulerState };
const state: SchedulerState = g.__nexoraScheduler ?? { started: false, timer: null, running: new Set(), lastTickAt: null };
g.__nexoraScheduler = state;

const log = logger.child({ component: "scheduler" });

/** Minute bucket key like "202609100241" — one claim per job per minute. */
function periodKey(d: Date): string {
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}${String(d.getUTCHours()).padStart(2, "0")}${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

/**
 * Try to claim a job's minute across the fleet. Returns true if THIS instance won
 * the claim (and should run), false if another instance already claimed it or the
 * claim could not be recorded. A unique-constraint violation is the normal "someone
 * else got it" path, not an error.
 */
async function claimPeriod(jobName: string, key: string): Promise<boolean> {
  try {
    await prisma.jobRunClaim.create({ data: { jobName, periodKey: key } });
    return true;
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === "P2002") return false; // already claimed by another instance
    log.warn("job claim failed", { jobName, periodKey: key, err: e });
    return false; // fail closed: don't double-run when the claim is uncertain
  }
}

/** Health/liveness signal for the scheduler (used by the readiness probe). */
export function getSchedulerHeartbeat(): { started: boolean; lastTickAt: Date | null } {
  return { started: state.started, lastTickAt: state.lastTickAt };
}

async function systemActorId(): Promise<string | null> {
  try {
    const admin = await prisma.user.findFirst({ where: { isSuperAdmin: true, archivedAt: null }, select: { id: true } });
    return admin?.id ?? null;
  } catch {
    return null;
  }
}

export interface JobRunResult {
  ok: boolean;
  durationMs: number;
  result?: unknown;
  error?: string;
}

/** Execute one job definition, recording a full run history entry. */
export async function runJob(def: JobDefinition, trigger: "scheduled" | "manual", actorId: string | null): Promise<JobRunResult> {
  if (state.running.has(def.name)) return { ok: false, durationMs: 0, error: "already running" };
  state.running.add(def.name);
  const started = new Date();

  const jobRow = await prisma.backgroundJob.findFirst({ where: { name: def.name } }).catch(() => null);
  const run = await prisma.backgroundJobRun.create({
    data: { jobId: jobRow?.id ?? null, jobName: def.name, trigger, status: "success", startedAt: started },
  }).catch(() => null);
  if (jobRow) await prisma.backgroundJob.update({ where: { id: jobRow.id }, data: { status: "running", lastRunAt: started, scheduleCron: def.cron } }).catch(() => {});

  try {
    const result = await def.run(actorId);
    const finishedAt = new Date();
    const durationMs = finishedAt.getTime() - started.getTime();
    if (run) await prisma.backgroundJobRun.update({ where: { id: run.id }, data: { status: "success", finishedAt, durationMs, resultJson: safeStringify(result) } }).catch(() => {});
    if (jobRow) await prisma.backgroundJob.update({ where: { id: jobRow.id }, data: { status: "success", lastRunAt: started, lastDurationMs: durationMs, lastError: null, nextRunAt: nextRun(def.cron, finishedAt) } }).catch(() => {});
    return { ok: true, durationMs, result };
  } catch (e) {
    const finishedAt = new Date();
    const durationMs = finishedAt.getTime() - started.getTime();
    const error = e instanceof Error ? e.message : String(e);
    if (run) await prisma.backgroundJobRun.update({ where: { id: run.id }, data: { status: "failed", finishedAt, durationMs, error } }).catch(() => {});
    if (jobRow) await prisma.backgroundJob.update({ where: { id: jobRow.id }, data: { status: "failed", lastDurationMs: durationMs, lastError: error, nextRunAt: nextRun(def.cron, finishedAt) } }).catch(() => {});
    log.error("job failed", { jobName: def.name, trigger, durationMs, err: e });
    return { ok: false, durationMs, error };
  } finally {
    state.running.delete(def.name);
  }
}

/** Manually trigger a job by name (used by the Ops Center "Run now" / retry). */
export async function runJobNow(name: string, actorId: string | null): Promise<JobRunResult> {
  const def = jobByName(name);
  if (!def) return { ok: false, durationMs: 0, error: "unknown job" };
  return runJob(def, "manual", actorId);
}

async function tick(): Promise<void> {
  const now = new Date();
  state.lastTickAt = now;
  // Purge old fleet claims once an hour so the table stays small.
  if (now.getUTCMinutes() === 0) void prisma.jobRunClaim.deleteMany({ where: { claimedAt: { lt: new Date(Date.now() - 3 * 86_400_000) } } }).catch(() => {});

  const due = JOB_DEFINITIONS.filter((d) => cronMatches(d.cron, now));
  if (due.length === 0) return;
  const key = periodKey(now);
  const actorId = await systemActorId();
  for (const def of due) {
    // Claim this minute across the fleet; only the instance that wins the unique
    // (jobName, minute) row runs it. Fire-and-forget; runJob also guards in-process.
    void (async () => {
      if (await claimPeriod(def.name, key)) void runJob(def, "scheduled", actorId);
    })();
  }
}

/** Start the scheduler once. No-op if already started or explicitly disabled. */
export function startScheduler(): void {
  if (state.started) return;
  if (process.env.NEXORA_DISABLE_SCHEDULER === "1") {
    log.info("scheduler disabled via NEXORA_DISABLE_SCHEDULER=1");
    return;
  }
  state.started = true;

  // Seed nextRunAt for display, best-effort.
  void (async () => {
    for (const def of JOB_DEFINITIONS) {
      const row = await prisma.backgroundJob.findFirst({ where: { name: def.name } }).catch(() => null);
      if (row) await prisma.backgroundJob.update({ where: { id: row.id }, data: { nextRunAt: nextRun(def.cron), scheduleCron: def.cron } }).catch(() => {});
    }
  })();

  // Align the first tick to the next minute boundary, then run every minute.
  const msToNextMinute = 60_000 - (Date.now() % 60_000);
  setTimeout(() => {
    void tick();
    state.timer = setInterval(() => void tick(), 60_000);
  }, msToNextMinute);
  log.info("scheduler started", { jobs: JOB_DEFINITIONS.length, firstTickInSec: Math.round(msToNextMinute / 1000) });
}

function safeStringify(v: unknown): string | null {
  try { return v == null ? null : JSON.stringify(v).slice(0, 2000); } catch { return null; }
}
