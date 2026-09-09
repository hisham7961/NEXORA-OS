import { route } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { pageMeta } from "@/lib/api/pagination";
import { listDocuments, documentQuerySchema } from "@/domain/documents";

/** GET /api/v1/documents */
export const GET = route(async ({ principal, req }) => {
  const query = documentQuerySchema.parse(Object.fromEntries(new URL(req.url).searchParams));
  const { rows, total } = await listDocuments(principal, query);
  return ok(rows, pageMeta(total, query));
});
