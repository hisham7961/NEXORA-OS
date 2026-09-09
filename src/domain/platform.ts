import { prisma } from "@/lib/db";
import { JOB_DEFINITIONS } from "@/lib/jobs/registry";
import { nextRun } from "@/lib/jobs/cron";

/**
 * Scheduled-jobs overview for the Admin Operations Center (§10, §75). Driven by
 * the JOB_DEFINITIONS registry (the source of truth) joined to each job's latest
 * BackgroundJobRun — so what's shown is what actually runs, not a seeded claim.
 */
export async function getJobsOverview() {
  const [latestRuns, recentRuns] = await Promise.all([
    prisma.backgroundJobRun.findMany({ orderBy: { startedAt: "desc" }, take: 200 }),
    prisma.backgroundJobRun.findMany({ orderBy: { startedAt: "desc" }, take: 25 }),
  ]);
  const latestByName = new Map<string, (typeof latestRuns)[number]>();
  for (const r of latestRuns) if (!latestByName.has(r.jobName)) latestByName.set(r.jobName, r);

  const jobs = JOB_DEFINITIONS.map((d) => {
    const last = latestByName.get(d.name) ?? null;
    return {
      name: d.name,
      cron: d.cron,
      description: d.description,
      permission: d.permission,
      nextRunAt: nextRun(d.cron),
      last: last ? { status: last.status, startedAt: last.startedAt, durationMs: last.durationMs, error: last.error, trigger: last.trigger } : null,
    };
  });
  return { jobs, recentRuns };
}

/** Developer Portal (§35) — never expose secrets. */
export async function getDeveloperPortal() {
  const [features, tokens, jobs, events] = await Promise.all([
    prisma.featureRegistry.findMany({ orderBy: { module: "asc" } }),
    // Deliberately never select tokenHash (§35 "Do NOT expose secrets").
    prisma.apiToken.findMany({ select: { id: true, name: true, prefix: true, lastUsedAt: true, expiresAt: true, revokedAt: true, createdAt: true }, orderBy: { createdAt: "desc" } }),
    prisma.backgroundJob.findMany({ orderBy: { updatedAt: "desc" } }),
    prisma.systemEvent.findMany({ orderBy: { createdAt: "desc" }, take: 20 }),
  ]);
  const endpoints = features.filter((f) => f.endpoint).map((f) => ({ name: f.name, endpoint: f.endpoint!, permission: f.permissionKey, mobile: f.mobileApiAvailable }));
  return { features, tokens, jobs, events, endpoints };
}

/** System Health / Ops Center (§37, §75). */
export async function getSystemHealth() {
  const [jobs, events, counts] = await Promise.all([
    prisma.backgroundJob.findMany({ orderBy: { updatedAt: "desc" } }),
    prisma.systemEvent.findMany({ orderBy: { createdAt: "desc" }, take: 30 }),
    Promise.all([
      prisma.backgroundJob.count({ where: { status: "success" } }),
      prisma.backgroundJob.count({ where: { status: "running" } }),
      prisma.backgroundJob.count({ where: { status: "failed" } }),
      prisma.backgroundJob.count({ where: { status: "queued" } }),
    ]),
  ]);
  const [success, running, failed, queued] = counts;
  return { jobs, events, summary: { success, running, failed, queued } };
}

/** System settings, grouped by category (§36). */
export async function getSettingsGrouped() {
  const settings = await prisma.systemSetting.findMany({ orderBy: [{ category: "asc" }, { key: "asc" }] });
  const groups = new Map<string, { key: string; value: string }[]>();
  for (const s of settings) {
    let value = s.valueJson;
    try {
      value = JSON.stringify(JSON.parse(s.valueJson));
    } catch {
      /* leave as-is */
    }
    const arr = groups.get(s.category) ?? [];
    arr.push({ key: s.key, value });
    groups.set(s.category, arr);
  }
  return [...groups.entries()].map(([category, items]) => ({ category, items }));
}
