import { route, ServiceError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { editMessage, deleteMessage, setMessagePinned, toggleReaction } from "@/domain/discussions";

/** PATCH /api/v1/discussions/messages/[id] — edit body, pin/unpin, or react (§30 parity). */
export const PATCH = route<{ id: string }>(async ({ principal, ip, userAgent, params, req }) => {
  const body = await req.json().catch(() => { throw new ServiceError("invalid_json", "Request body must be valid JSON", 400); });
  const ctx = { principal, ip, userAgent };
  const b = body as { body?: string; pinned?: boolean; emoji?: string };
  if (typeof b.body === "string") { await editMessage(ctx, params.id, b.body); return ok({ id: params.id, edited: true }); }
  if (typeof b.pinned === "boolean") { await setMessagePinned(ctx, params.id, b.pinned); return ok({ id: params.id, pinned: b.pinned }); }
  if (b.emoji) { await toggleReaction(ctx, params.id, b.emoji); return ok({ id: params.id, reacted: true }); }
  throw new ServiceError("no_op", "Provide body, pinned, or emoji", 400);
});

/** DELETE /api/v1/discussions/messages/[id] — soft-delete a message (§30 parity). */
export const DELETE = route<{ id: string }>(async ({ principal, ip, userAgent, params }) => {
  await deleteMessage({ principal, ip, userAgent }, params.id);
  return ok({ id: params.id, deleted: true });
});
