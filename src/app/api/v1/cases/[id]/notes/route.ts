import { route, ServiceError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { addCaseNote } from "@/domain/cases";

/** POST /api/v1/cases/[id]/notes — add a case note (§30 parity). */
export const POST = route<{ id: string }>(async ({ principal, ip, userAgent, params, req }) => {
  const body = await req.json().catch(() => { throw new ServiceError("invalid_json", "Request body must be valid JSON", 400); });
  const text = (body as { body?: string }).body;
  if (!text) throw new ServiceError("missing_body", "body is required", 400);
  await addCaseNote({ principal, ip, userAgent }, params.id, text, !!(body as { isInternal?: boolean }).isInternal);
  return ok({ id: params.id, added: true });
});
