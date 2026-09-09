import { route, ServiceError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { decideAttendanceCorrection } from "@/domain/attendance";

/** POST /api/v1/attendance/corrections/:id/decide { decision, note } */
export const POST = route<{ id: string }>(async ({ principal, ip, userAgent, params, req }) => {
  const body = await req.json().catch(() => ({}));
  const decision = body?.decision;
  if (!["approved", "rejected", "changes_requested"].includes(decision)) throw new ServiceError("bad_decision", "Invalid decision", 400);
  await decideAttendanceCorrection({ principal, ip, userAgent }, params.id, decision, typeof body?.note === "string" ? body.note : undefined);
  return ok({ decided: true });
});
