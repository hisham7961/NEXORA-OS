import { route, ServiceError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requestAttendanceCorrection, listMyCorrections, listPendingCorrections } from "@/domain/attendance";

/** GET /api/v1/attendance/corrections?scope=mine|pending */
export const GET = route(async ({ principal, req }) => {
  const scope = new URL(req.url).searchParams.get("scope") ?? "mine";
  return ok(scope === "pending" ? await listPendingCorrections(principal) : await listMyCorrections(principal));
});

/** POST /api/v1/attendance/corrections — request a correction for your own attendance. */
export const POST = route(async ({ principal, ip, userAgent, req }) => {
  const body = await req.json().catch(() => { throw new ServiceError("invalid_json", "Request body must be valid JSON", 400); });
  return ok(await requestAttendanceCorrection({ principal, ip, userAgent }, body));
});
