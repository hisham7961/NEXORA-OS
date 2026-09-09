import { route } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { submitAnswerForApproval } from "@/domain/answers";
export const POST = route<{ id: string }>(async ({ principal, ip, userAgent, params }) => {
  await submitAnswerForApproval({ principal, ip, userAgent }, params.id);
  return ok({ submitted: true });
});
