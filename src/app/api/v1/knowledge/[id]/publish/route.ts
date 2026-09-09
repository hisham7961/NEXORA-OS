import { route } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { publishArticle } from "@/domain/knowledge";
export const POST = route<{ id: string }>(async ({ principal, ip, userAgent, params }) => {
  await publishArticle({ principal, ip, userAgent }, params.id);
  return ok({ published: true });
});
