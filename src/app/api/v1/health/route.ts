import { ok, fail } from "@/lib/api/response";
import { readinessReport } from "@/domain/health";

/**
 * Readiness probe for the versioned API (§39-40). Checks that this instance can
 * actually serve: the database answers, the object store round-trips, and the
 * scheduler is ticking. Returns 503 when any critical dependency is down so a load
 * balancer routes away from this instance. No auth (must work before login);
 * details are coarse and never leak internals. See /api/v1/health/live for liveness.
 */
export async function GET() {
  const report = await readinessReport();
  const body = { status: report.ok ? "ok" : "degraded", api: "v1", time: new Date().toISOString(), checks: report.checks };
  return report.ok ? ok(body) : fail("not_ready", "One or more dependencies are unavailable", 503, body);
}
