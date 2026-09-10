import { route } from "@/lib/api/handler";
import { generateOpenApi } from "@/domain/api-docs";

/**
 * GET /api/v1/openapi.json — machine-readable API contract (§34-35) for the
 * declared surface plus the always-on endpoints. Authenticated (a Bearer API
 * token works), so tooling can pull it with the same credential it will call with.
 */
export const GET = route(async () => {
  const doc = await generateOpenApi();
  return new Response(JSON.stringify(doc, null, 2), {
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
});
