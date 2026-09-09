import { route } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { joinChannel } from "@/domain/discussions";
/** POST /api/v1/discussions/[id]/join — join a channel (§30 parity). */
export const POST = route<{ id: string }>(async ({ principal, ip, userAgent, params }) => {
  await joinChannel({ principal, ip, userAgent }, params.id);
  return ok({ id: params.id, joined: true });
});
