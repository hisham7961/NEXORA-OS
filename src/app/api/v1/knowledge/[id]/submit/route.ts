import { route } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { submitArticleForReview } from "@/domain/knowledge";
export const POST = route<{ id: string }>(async ({ principal, ip, userAgent, params }) => {
  await submitArticleForReview({ principal, ip, userAgent }, params.id);
  return ok({ submitted: true });
});
