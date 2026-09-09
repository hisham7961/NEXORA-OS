import { route, ServiceError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { setRequirementStatus } from "@/domain/registrations";
/** PATCH /api/v1/registrations/[id]/requirements/[reqId] — set a requirement's status (§30 parity). */
export const PATCH = route<{ id: string; reqId: string }>(async ({ principal, ip, userAgent, params, req }) => {
  const body = await req.json().catch(() => { throw new ServiceError("invalid_json", "Request body must be valid JSON", 400); });
  const status = (body as { status?: string }).status;
  if (!status) throw new ServiceError("missing_status", "status is required", 400);
  await setRequirementStatus({ principal, ip, userAgent }, params.id, params.reqId, status);
  return ok({ id: params.id, reqId: params.reqId, status });
});
