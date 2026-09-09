import { route, ServiceError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { getArticle, updateArticleDraft } from "@/domain/knowledge";
export const GET = route<{ id: string }>(async ({ principal, params }) => {
  const a = await getArticle(principal, params.id);
  if (!a) throw new ServiceError("not_found", "Article not found", 404);
  return ok(a);
});

/** PATCH /api/v1/knowledge/:id — edit the working draft version (§30 parity). */
export const PATCH = route<{ id: string }>(async ({ principal, ip, userAgent, params, req }) => {
  const body = await req.json().catch(() => { throw new ServiceError("invalid_json", "Request body must be valid JSON", 400); });
  await updateArticleDraft({ principal, ip, userAgent }, params.id, body);
  return ok({ id: params.id, updated: true });
});
