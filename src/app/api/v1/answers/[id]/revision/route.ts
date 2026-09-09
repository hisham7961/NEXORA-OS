import { route, ServiceError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { createAnswerRevision } from "@/domain/answers";

/** POST /api/v1/answers/[id]/revision — start a new draft revision (§30 parity). */
export const POST = route<{ id: string }>(async ({ principal, ip, userAgent, params, req }) => {
  const body = await req.json().catch(() => { throw new ServiceError("invalid_json", "Request body must be valid JSON", 400); });
  const answer = (body as { answer?: string }).answer;
  if (!answer) throw new ServiceError("missing_answer", "answer is required", 400);
  return ok(await createAnswerRevision({ principal, ip, userAgent }, params.id, answer, (body as { changeNote?: string }).changeNote));
});
