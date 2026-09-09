import { route, ServiceError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { convertMessage } from "@/domain/discussions";
/** POST /api/v1/discussions/messages/[id]/convert — convert a message to work (§30 parity). */
export const POST = route<{ id: string }>(async ({ principal, ip, userAgent, params, req }) => {
  const body = await req.json().catch(() => { throw new ServiceError("invalid_json", "Request body must be valid JSON", 400); });
  const { target, ...extra } = body as { target?: string; title?: string; assigneeIds?: string[]; approverIds?: string[]; ownerId?: string };
  if (!target) throw new ServiceError("missing_target", "target is required (task|approval|case|design)", 400);
  return ok(await convertMessage({ principal, ip, userAgent }, params.id, target as never, extra));
});
