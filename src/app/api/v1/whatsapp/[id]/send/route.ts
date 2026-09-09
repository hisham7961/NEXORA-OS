import { route } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { markWhatsappSent } from "@/domain/whatsapp";

/** POST /api/v1/whatsapp/:id/send — mark sent (third-party executed). */
export const POST = route<{ id: string }>(async ({ principal, ip, userAgent, params }) => {
  const wa = await markWhatsappSent({ principal, ip, userAgent }, params.id);
  return ok(wa);
});
