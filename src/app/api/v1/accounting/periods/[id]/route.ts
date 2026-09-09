import { route, ServiceError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { setPeriodStatus } from "@/domain/accounting/fiscal";
export const PATCH = route<{ id: string }>(async ({ principal, ip, userAgent, params, req }) => {
  const body = await req.json().catch(() => { throw new ServiceError("invalid_json", "Invalid JSON", 400); });
  const status = (body as { status?: string }).status;
  if (!status) throw new ServiceError("missing_status", "status is required", 400);
  await setPeriodStatus({ principal, ip, userAgent }, params.id, status as never, (body as { note?: string }).note);
  return ok({ id: params.id, status });
});
