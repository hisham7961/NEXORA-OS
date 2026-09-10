import { route } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { globalSearch } from "@/domain/search";

/**
 * GET /api/v1/search — universal search across entity types, delegated to the
 * shared search domain (src/domain/search.ts). Every branch there is permission-
 * gated AND scope-filtered, so results never leak records the caller cannot see
 * (§29, §69). Used by the Cmd/K command palette.
 */
export const GET = route(async ({ principal, req }) => {
  const q = new URL(req.url).searchParams.get("q") ?? "";
  return ok(await globalSearch(principal, q));
});
