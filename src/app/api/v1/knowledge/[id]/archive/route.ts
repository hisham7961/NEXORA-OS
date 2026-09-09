import { route } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { archiveArticle } from "@/domain/knowledge";

/** POST /api/v1/knowledge/[id]/archive — archive an article (§30 parity). */
export const POST = route<{ id: string }>(async ({ principal, ip, userAgent, params }) => {
  await archiveArticle({ principal, ip, userAgent }, params.id);
  return ok({ id: params.id, archived: true });
});
