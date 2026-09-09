import { route } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { confirmPublished } from "@/domain/social";

/** POST /api/v1/social/:id/publish — checkpoint 2: confirm published (+URL). */
export const POST = route<{ id: string }>(async ({ principal, ip, userAgent, params, req }) => {
  const body = await req.json().catch(() => ({}));
  const item = await confirmPublished({ principal, ip, userAgent }, params.id, typeof body?.publishedUrl === "string" ? body.publishedUrl : undefined);
  return ok(item);
});
