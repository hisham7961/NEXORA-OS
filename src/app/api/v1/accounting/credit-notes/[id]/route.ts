import { route, ServiceError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { getCreditNote } from "@/domain/accounting/ar";

export const GET = route<{ id: string }>(async ({ principal, params }) => {
  const cn = await getCreditNote(principal, params.id);
  if (!cn) throw new ServiceError("not_found", "Credit note not found", 404);
  return ok(cn);
});
