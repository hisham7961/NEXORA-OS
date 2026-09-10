import { route, ServiceError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { setLineReconciled } from "@/domain/accounting/bank";

export const POST = route<{ id: string }>(async ({ principal, ip, userAgent, params, req }) => {
  const body = await req.json().catch(() => { throw new ServiceError("invalid_json", "Invalid JSON", 400); });
  const { journalLineId, cleared } = body as { journalLineId?: string; cleared?: boolean };
  if (!journalLineId) throw new ServiceError("missing_line", "journalLineId is required", 400);
  return ok(await setLineReconciled({ principal, ip, userAgent }, params.id, journalLineId, cleared !== false));
});
