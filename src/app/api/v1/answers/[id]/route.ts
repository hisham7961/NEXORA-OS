import { route, ServiceError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { getAnswer } from "@/domain/answers";

/** GET /api/v1/answers/:id — with version history. */
export const GET = route<{ id: string }>(async ({ principal, params }) => {
  const a = await getAnswer(principal, params.id);
  if (!a) throw new ServiceError("not_found", "Answer not found", 404);
  return ok(a);
});
