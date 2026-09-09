import { route, ServiceError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { postJournalEntry } from "@/domain/accounting/posting";
export const POST = route(async ({ principal, ip, userAgent, req }) => {
  const body = await req.json().catch(() => { throw new ServiceError("invalid_json", "Invalid JSON", 400); });
  return ok(await postJournalEntry({ principal, ip, userAgent }, body));
});
