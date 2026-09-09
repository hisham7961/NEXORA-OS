import { route, ServiceError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { pageMeta } from "@/lib/api/pagination";
import { listKnowledge, createArticleDraft, knowledgeQuerySchema } from "@/domain/knowledge";

export const GET = route(async ({ principal, req }) => {
  const query = knowledgeQuerySchema.parse(Object.fromEntries(new URL(req.url).searchParams));
  const { rows, total } = await listKnowledge(principal, query);
  return ok(rows, pageMeta(total, query));
});
export const POST = route(async ({ principal, ip, userAgent, req }) => {
  const body = await req.json().catch(() => { throw new ServiceError("invalid_json", "Request body must be valid JSON", 400); });
  return ok(await createArticleDraft({ principal, ip, userAgent }, body));
});
