import { route, ServiceError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { pageMeta } from "@/lib/api/pagination";
import { listWhatsapp, createWhatsappCampaign, whatsappQuerySchema } from "@/domain/whatsapp";

/** GET /api/v1/whatsapp */
export const GET = route(async ({ principal, req }) => {
  const query = whatsappQuerySchema.parse(Object.fromEntries(new URL(req.url).searchParams));
  const { rows, total } = await listWhatsapp(principal, query);
  return ok(rows, pageMeta(total, query));
});

/** POST /api/v1/whatsapp — brief a new campaign. */
export const POST = route(async ({ principal, ip, userAgent, req }) => {
  const body = await req.json().catch(() => { throw new ServiceError("invalid_json", "Request body must be valid JSON", 400); });
  const wa = await createWhatsappCampaign({ principal, ip, userAgent }, body);
  return ok(wa);
});
