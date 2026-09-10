import { route, ServiceError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { previewStatement } from "@/domain/accounting/statement-import";

export const POST = route(async ({ principal, req }) => {
  const body = await req.json().catch(() => { throw new ServiceError("invalid_json", "Invalid JSON", 400); });
  const { companyId, bankAccountId, csvText, mapping } = body as { companyId?: string; bankAccountId?: string; csvText?: string; mapping?: unknown };
  if (!companyId || !bankAccountId || !csvText) throw new ServiceError("missing", "companyId, bankAccountId and csvText are required", 400);
  return ok(await previewStatement(principal, companyId, bankAccountId, csvText, mapping));
});
