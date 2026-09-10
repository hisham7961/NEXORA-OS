import { route, ServiceError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { editComment, deleteComment } from "@/domain/comments";

export const PATCH = route<{ id: string }>(async ({ principal, ip, userAgent, params, req }) => {
  const body = await req.json().catch(() => { throw new ServiceError("invalid_json", "Invalid JSON", 400); });
  const text = (body as { body?: string }).body;
  if (!text) throw new ServiceError("missing_body", "body is required", 400);
  return ok(await editComment({ principal, ip, userAgent }, params.id, text));
});
export const DELETE = route<{ id: string }>(async ({ principal, ip, userAgent, params }) => {
  await deleteComment({ principal, ip, userAgent }, params.id);
  return ok({ id: params.id, deleted: true });
});
