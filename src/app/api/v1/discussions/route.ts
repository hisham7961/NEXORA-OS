import { route, ServiceError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { listChannels, createChannel } from "@/domain/discussions";

/** GET /api/v1/discussions — channels the caller can see (with unread counts). */
export const GET = route(async ({ principal }) => ok(await listChannels(principal)));

/** POST /api/v1/discussions — create a channel. */
export const POST = route(async ({ principal, ip, userAgent, req }) => {
  const body = await req.json().catch(() => { throw new ServiceError("invalid_json", "Request body must be valid JSON", 400); });
  return ok(await createChannel({ principal, ip, userAgent }, body));
});
