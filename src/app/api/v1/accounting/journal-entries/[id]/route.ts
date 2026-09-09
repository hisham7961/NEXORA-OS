import { route, ServiceError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { getJournalEntry } from "@/domain/accounting/posting";
export const GET = route<{ id: string }>(async ({ principal, params }) => {
  const e = await getJournalEntry(principal, params.id);
  if (!e) throw new ServiceError("not_found", "Entry not found", 404);
  return ok(e);
});
