import { prisma } from "@/lib/db";
import { cronMatches, nextRun } from "./cron";
import { JOB_DEFINITIONS, jobByName, type JobDefinition } from "./registry";

/**
 * In-process job scheduler (§10). Next.js `instrumentation.ts` calls
 * `startScheduler()` once at server startup; a minute-aligned interval then fires
 * any job whose cron matches the current minute. Every run is recorded in
 * BackgroundJobRun (history, duration, error) and reflected on the job's
 * BackgroundJob row, so the Admin Operations Center shows real state — nothing
 * runs invisibly (§74/§75). Runners are idempotent, so a missed/retried tick is safe.
 *
 * This is a single-process scheduler suitable for a single app instance. For a
 * multi-instance deployment, front it with a DB advisory lock or an external
 * scheduler hitting the same runJobNow() path; the run-recording contract is identical.
 */

interface SchedulerState {
  started: boolean;
  timer: ReturnType<typeof setInterval> | null;
  running: Set<string>;
}

const g = globalThis as unknown as { __nexoraScheduler?: SchedulerState };
const state: SchedulerState = g.__nexoraScheduler ?? { started: false, timer: null, running: new Set() };
g.__nexoraScheduler = state;

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
    console.error(`[scheduler] job "${def.name}" failed:`, error);
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
  const due = JOB_DEFINITIONS.filter((d) => cronMatches(d.cron, now));
  if (due.length === 0) return;
  const actorId = await systemActorId();
  for (const def of due) {
    // Fire-and-forget within the tick; runJob guards against overlap.
    void runJob(def, "scheduled", actorId);
  }
}

/** Start the scheduler once. No-op if already started or explicitly disabled. */
export function startScheduler(): void {
  if (state.started) return;
  if (process.env.NEXORA_DISABLE_SCHEDULER === "1") {
    console.log("[scheduler] disabled via NEXORA_DISABLE_SCHEDULER=1");
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
  console.log(`[scheduler] started — ${JOB_DEFINITIONS.length} jobs, first tick in ${Math.round(msToNextMinute / 1000)}s`);
}

function safeStringify(v: unknown): string | null {
  try { return v == null ? null : JSON.stringify(v).slice(0, 2000); } catch { return null; }
}
