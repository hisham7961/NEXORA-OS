import { route } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { issueCreditNote } from "@/domain/accounting/ar";

export const POST = route<{ id: string }>(async ({ principal, ip, userAgent, params }) => {
  return ok(await issueCreditNote({ principal, ip, userAgent }, params.id));
});
