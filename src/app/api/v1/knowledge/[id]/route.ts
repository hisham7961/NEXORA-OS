import { route, ServiceError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { getArticle } from "@/domain/knowledge";
export const GET = route<{ id: string }>(async ({ principal, params }) => {
  const a = await getArticle(principal, params.id);
  if (!a) throw new ServiceError("not_found", "Article not found", 404);
  return ok(a);
});
