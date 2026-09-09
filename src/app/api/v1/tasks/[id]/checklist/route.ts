import { route, ServiceError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { addChecklistItem, toggleChecklistItem } from "@/domain/tasks";

/** POST /api/v1/tasks/[id]/checklist — add a checklist item (§30 parity). */
export const POST = route<{ id: string }>(async ({ principal, ip, userAgent, params, req }) => {
  const body = await req.json().catch(() => { throw new ServiceError("invalid_json", "Request body must be valid JSON", 400); });
  const text = (body as { text?: string }).text;
  if (!text) throw new ServiceError("missing_text", "text is required", 400);
  await addChecklistItem({ principal, ip, userAgent }, params.id, text);
  return ok({ id: params.id, added: true });
});

/** PATCH /api/v1/tasks/[id]/checklist — toggle an item done/undone (§30 parity). */
export const PATCH = route<{ id: string }>(async ({ principal, ip, userAgent, params, req }) => {
  const body = await req.json().catch(() => { throw new ServiceError("invalid_json", "Request body must be valid JSON", 400); });
  const itemId = (body as { itemId?: string }).itemId;
  if (!itemId) throw new ServiceError("missing_item", "itemId is required", 400);
  await toggleChecklistItem({ principal, ip, userAgent }, params.id, itemId, !!(body as { done?: boolean }).done);
  return ok({ id: params.id, itemId, toggled: true });
});
