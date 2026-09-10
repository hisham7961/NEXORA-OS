import { route, ServiceError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { getStatement } from "@/domain/accounting/statement-import";

export const GET = route<{ id: string }>(async ({ principal, params }) => {
  const s = await getStatement(principal, params.id);
  if (!s) throw new ServiceError("not_found", "Statement not found", 404);
  return ok(s);
});
