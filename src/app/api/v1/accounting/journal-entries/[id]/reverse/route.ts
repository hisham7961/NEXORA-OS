import { route, ServiceError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { reverseEntry } from "@/domain/accounting/posting";
export const POST = route<{ id: string }>(async ({ principal, ip, userAgent, params, req }) => {
  const body = await req.json().catch(() => { throw new ServiceError("invalid_json", "Invalid JSON", 400); });
  const reason = (body as { reason?: string }).reason;
  if (!reason) throw new ServiceError("reason_required", "reason is required", 400);
  return ok(await reverseEntry({ principal, ip, userAgent }, params.id, { reason, date: (body as { date?: string }).date ? new Date((body as { date: string }).date) : undefined }));
});
