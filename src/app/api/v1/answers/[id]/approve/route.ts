import { route } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { approveAnswer } from "@/domain/answers";
export const POST = route<{ id: string }>(async ({ principal, ip, userAgent, params }) => {
  await approveAnswer({ principal, ip, userAgent }, params.id);
  return ok({ approved: true });
});
