import { route } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { suggestMatches } from "@/domain/accounting/statement-import";

export const GET = route<{ id: string }>(async ({ principal, params }) => {
  return ok(await suggestMatches(principal, params.id));
});
