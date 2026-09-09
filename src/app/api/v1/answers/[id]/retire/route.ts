import { route } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { retireAnswer } from "@/domain/answers";

/** POST /api/v1/answers/[id]/retire — retire an approved answer (§30 parity). */
export const POST = route<{ id: string }>(async ({ principal, ip, userAgent, params }) => {
  await retireAnswer({ principal, ip, userAgent }, params.id);
  return ok({ id: params.id, retired: true });
});
