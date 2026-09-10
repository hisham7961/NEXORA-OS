import { ok } from "@/lib/api/response";

/**
 * Liveness probe (§39-40): the process is up and can serve a request. No
 * dependencies are checked, so a transient DB/storage blip never triggers a
 * pod restart — that is what the readiness probe (/api/v1/health) is for. No auth.
 */
export async function GET() {
  return ok({ status: "ok", api: "v1", time: new Date().toISOString() });
}
