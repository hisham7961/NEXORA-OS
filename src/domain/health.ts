import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import { getStorage } from "@/lib/storage";
import { getSchedulerHeartbeat } from "@/lib/jobs/scheduler";

/**
 * Health probes (§39-40). Liveness = "the process is up" (cheap, no dependencies).
 * Readiness = "this instance can actually serve traffic": the database answers, the
 * object store round-trips, and this instance's scheduler is ticking. A load
 * balancer / k8s uses readiness to route only to healthy instances.
 */
export interface Check { ok: boolean; detail?: string; latencyMs?: number }
export interface ReadinessReport { ok: boolean; checks: { database: Check; storage: Check; scheduler: Check } }

async function checkDatabase(): Promise<Check> {
  const t = Date.now();
  try { await prisma.$queryRaw`SELECT 1`; return { ok: true, latencyMs: Date.now() - t }; }
  catch (e) { return { ok: false, detail: e instanceof Error ? e.message : "query failed" }; }
}

// A storage round-trip writes a byte, so cache the result briefly to avoid churn
// under a frequent readiness poll.
let storageCache: { at: number; check: Check } | null = null;
const STORAGE_TTL_MS = 30_000;
async function checkStorage(): Promise<Check> {
  if (storageCache && Date.now() - storageCache.at < STORAGE_TTL_MS) return storageCache.check;
  const t = Date.now();
  let check: Check;
  try {
    const storage = getStorage();
    const key = `health/probe-${randomBytes(8).toString("hex")}`;
    const payload = Buffer.from("ok");
    await storage.put(key, payload, "text/plain");
    const got = await storage.get(key);
    await storage.remove(key).catch(() => {});
    check = got.body.equals(payload)
      ? { ok: true, detail: storage.name, latencyMs: Date.now() - t }
      : { ok: false, detail: `${storage.name}: round-trip mismatch` };
  } catch (e) {
    check = { ok: false, detail: e instanceof Error ? e.message : "storage error" };
  }
  storageCache = { at: Date.now(), check };
  return check;
}

function checkScheduler(): Check {
  if (process.env.NEXORA_DISABLE_SCHEDULER === "1") return { ok: true, detail: "disabled by config" };
  const { started, lastTickAt } = getSchedulerHeartbeat();
  if (!started) return { ok: true, detail: "starting" }; // just booted; not a failure
  if (!lastTickAt) return { ok: true, detail: "started, awaiting first tick" };
  const ageMs = Date.now() - lastTickAt.getTime();
  return ageMs < 90_000 ? { ok: true, detail: `last tick ${Math.round(ageMs / 1000)}s ago` } : { ok: false, detail: `no tick for ${Math.round(ageMs / 1000)}s` };
}

/** Full readiness: DB + storage round-trip + scheduler heartbeat. */
export async function readinessReport(): Promise<ReadinessReport> {
  const [database, storage] = await Promise.all([checkDatabase(), checkStorage()]);
  const scheduler = checkScheduler();
  return { ok: database.ok && storage.ok && scheduler.ok, checks: { database, storage, scheduler } };
}
