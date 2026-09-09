import { route } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { markChannelRead } from "@/domain/discussions";

/** POST /api/v1/discussions/:id/read — mark the channel read up to now. */
export const POST = route<{ id: string }>(async ({ principal, ip, userAgent, params }) => {
  await markChannelRead({ principal, ip, userAgent }, params.id);
  return ok({ read: true });
});
