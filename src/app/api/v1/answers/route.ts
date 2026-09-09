import { route, ServiceError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { pageMeta } from "@/lib/api/pagination";
import { listAnswers, createAnswerDraft, answerQuerySchema } from "@/domain/answers";

/** GET /api/v1/answers */
export const GET = route(async ({ principal, req }) => {
  const query = answerQuerySchema.parse(Object.fromEntries(new URL(req.url).searchParams));
  const { rows, total } = await listAnswers(principal, query);
  return ok(rows, pageMeta(total, query));
});

/** POST /api/v1/answers — create a draft answer. */
export const POST = route(async ({ principal, ip, userAgent, req }) => {
  const body = await req.json().catch(() => { throw new ServiceError("invalid_json", "Request body must be valid JSON", 400); });
  return ok(await createAnswerDraft({ principal, ip, userAgent }, body));
});
