import { route } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { findApprovedAnswers } from "@/domain/answers";

/** GET /api/v1/answers/find?q=&brandId=&productId=&countryId= — for case integration. */
export const GET = route(async ({ principal, req }) => {
  const u = new URL(req.url).searchParams;
  const rows = await findApprovedAnswers(principal, { q: u.get("q") ?? undefined, brandId: u.get("brandId"), productId: u.get("productId"), countryId: u.get("countryId"), language: u.get("language") ?? undefined });
  return ok(rows);
});
