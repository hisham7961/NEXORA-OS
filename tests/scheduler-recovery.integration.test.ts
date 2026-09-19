import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { recoverOrphanedRuns, runJob } from "@/lib/jobs/scheduler";
import type { JobDefinition } from "@/lib/jobs/registry";

/**
 * Regression for audit PLAT-01/02: the Ops Center must show truthful job state.
 * (1) A run row is born "running" and only becomes "success" once the runner returns
 *     — a crash mid-run never leaves a false "success".
 * (2) recoverOrphanedRuns() reaps a job/run stranded "running" by a crash to "failed",
 *     but leaves a genuinely fresh in-flight run alone (fleet-safe threshold).
 *
 * DB-gated: skips when no Postgres is reachable; runs in CI.
 */
const P = "schedtest_";
let dbUp = false;
beforeAll(async () => { try { await prisma.$queryRaw`select 1`; dbUp = true; } catch { dbUp = false; } await cleanup(); });
afterAll(async () => { if (dbUp) await cleanup(); });
async function cleanup() {
  if (!dbUp) return;
  await prisma.backgroundJobRun.deleteMany({ where: { jobName: { startsWith: P } } }).catch(() => {});
  await prisma.backgroundJob.deleteMany({ where: { name: { startsWith: P } } }).catch(() => {});
}

const okDef: JobDefinition = { name: P + "ok", cron: "* * * * *", description: "test", permission: "settings.manage", run: async () => ({ did: "work" }) };
const failDef: JobDefinition = { name: P + "fail", cron: "* * * * *", description: "test", permission: "settings.manage", run: async () => { throw new Error("boom"); } };

describe("PLAT-01/02 — truthful scheduler state", () => {
  it("a successful run ends 'success' (born 'running', updated on return)", async () => {
    if (!dbUp) return;
    const r = await runJob(okDef, "manual", null);
    expect(r.ok).toBe(true);
    const run = await prisma.backgroundJobRun.findFirst({ where: { jobName: P + "ok" }, orderBy: { startedAt: "desc" } });
    expect(run?.status).toBe("success");
    expect(run?.finishedAt).not.toBeNull();
  });

  it("a throwing run ends 'failed', never a false 'success'", async () => {
    if (!dbUp) return;
    const r = await runJob(failDef, "manual", null);
    expect(r.ok).toBe(false);
    const run = await prisma.backgroundJobRun.findFirst({ where: { jobName: P + "fail" }, orderBy: { startedAt: "desc" } });
    expect(run?.status).toBe("failed");
    expect(run?.error).toContain("boom");
  });

  it("reaps a crash-stranded 'running' run (older than the threshold) to 'failed'", async () => {
    if (!dbUp) return;
    const old = new Date(Date.now() - 20 * 60_000);
    const stranded = await prisma.backgroundJobRun.create({ data: { jobName: P + "stranded", trigger: "scheduled", status: "running", startedAt: old } });
    await recoverOrphanedRuns();
    const after = await prisma.backgroundJobRun.findUnique({ where: { id: stranded.id } });
    expect(after?.status).toBe("failed");
    expect(after?.finishedAt).not.toBeNull();
    expect(after?.error).toMatch(/interrupted/i);
  });

  it("leaves a genuinely fresh in-flight 'running' run untouched (fleet-safe)", async () => {
    if (!dbUp) return;
    const fresh = await prisma.backgroundJobRun.create({ data: { jobName: P + "fresh", trigger: "scheduled", status: "running", startedAt: new Date() } });
    await recoverOrphanedRuns();
    const after = await prisma.backgroundJobRun.findUnique({ where: { id: fresh.id } });
    expect(after?.status).toBe("running");
  });

  it("reaps a job stuck 'running' from a previous crash", async () => {
    if (!dbUp) return;
    const job = await prisma.backgroundJob.create({ data: { name: P + "job", type: "recurring", status: "running", lastRunAt: new Date(Date.now() - 20 * 60_000) } });
    await recoverOrphanedRuns();
    const after = await prisma.backgroundJob.findUnique({ where: { id: job.id } });
    expect(after?.status).toBe("failed");
    expect(after?.lastError).toMatch(/interrupted/i);
  });
});
