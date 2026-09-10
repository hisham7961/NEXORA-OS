import { route, ServiceError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { confirmMatch } from "@/domain/accounting/statement-import";

export const POST = route<{ id: string }>(async ({ principal, ip, userAgent, params, req }) => {
  const body = await req.json().catch(() => { throw new ServiceError("invalid_json", "Invalid JSON", 400); });
  const { statementLineId, journalLineId } = body as { statementLineId?: string; journalLineId?: string };
  if (!statementLineId || !journalLineId) throw new ServiceError("missing", "statementLineId and journalLineId are required", 400);
  await confirmMatch({ principal, ip, userAgent }, params.id, statementLineId, journalLineId);
  return ok({ matched: true });
});
