import { route, ServiceError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { listMessages, postMessage } from "@/domain/discussions";

/** GET /api/v1/discussions/:id/messages?before= */
export const GET = route<{ id: string }>(async ({ principal, params, req }) => {
  const before = new URL(req.url).searchParams.get("before") ?? undefined;
  return ok(await listMessages(principal, params.id, { before }));
});

/** POST /api/v1/discussions/:id/messages */
export const POST = route<{ id: string }>(async ({ principal, ip, userAgent, params, req }) => {
  const body = await req.json().catch(() => { throw new ServiceError("invalid_json", "Request body must be valid JSON", 400); });
  return ok(await postMessage({ principal, ip, userAgent }, params.id, body));
});
