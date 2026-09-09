import { route, ServiceError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { createArticleRevision } from "@/domain/knowledge";

/** POST /api/v1/knowledge/[id]/revision — start a new draft revision (§30 parity). */
export const POST = route<{ id: string }>(async ({ principal, ip, userAgent, params, req }) => {
  const body = await req.json().catch(() => { throw new ServiceError("invalid_json", "Request body must be valid JSON", 400); });
  const bodyText = (body as { body?: string }).body;
  if (!bodyText) throw new ServiceError("missing_body", "body is required", 400);
  return ok(await createArticleRevision({ principal, ip, userAgent }, params.id, bodyText, (body as { changeNote?: string }).changeNote, (body as { title?: string }).title));
});
