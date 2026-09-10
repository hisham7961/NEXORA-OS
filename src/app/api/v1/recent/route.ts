import { route, ServiceError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { listRecent, trackRecent } from "@/domain/personal";

export const GET = route(async ({ principal }) => ok(await listRecent(principal)));
export const POST = route(async ({ principal, ip, userAgent, req }) => {
  const body = await req.json().catch(() => { throw new ServiceError("invalid_json", "Invalid JSON", 400); });
  const { entityType, entityId, label, href } = body as { entityType?: string; entityId?: string; label?: string; href?: string };
  if (!entityType || !entityId) throw new ServiceError("missing", "entityType and entityId are required", 400);
  await trackRecent({ principal, ip, userAgent }, { entityType, entityId, label, href });
  return ok({ tracked: true });
});
