import { route, ServiceError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { changeStage } from "@/domain/registrations";

/** POST /api/v1/registrations/:id/stage — { status, comment? }. Records a timeline event. */
export const POST = route<{ id: string }>(async ({ principal, ip, userAgent, params, req }) => {
  const body = await req.json().catch(() => {
    throw new ServiceError("invalid_json", "Request body must be valid JSON", 400);
  });
  if (typeof body?.status !== "string") throw new ServiceError("missing_status", "status is required", 400);
  const r = await changeStage({ principal, ip, userAgent }, params.id, body.status, typeof body.comment === "string" ? body.comment : undefined);
  return ok(r);
});
