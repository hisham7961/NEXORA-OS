import { route, ServiceError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { completeChecklistItem } from "@/domain/daily-checks";

/** PATCH /api/v1/daily-checks/[id]/items/[itemId] — tick/untick a single check item (§30 parity). */
export const PATCH = route<{ id: string; itemId: string }>(async ({ principal, ip, userAgent, params, req }) => {
  const body = await req.json().catch(() => { throw new ServiceError("invalid_json", "Request body must be valid JSON", 400); });
  const b = body as { done?: boolean; note?: string; link?: string };
  await completeChecklistItem({ principal, ip, userAgent }, params.id, params.itemId, { done: !!b.done, note: b.note, link: b.link });
  return ok({ id: params.id, itemId: params.itemId, done: !!b.done });
});
