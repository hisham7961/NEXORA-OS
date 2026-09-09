import { route, ServiceError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { attachFile, detachFile } from "@/domain/files";

/** POST /api/v1/files/[id]/attach — attach a file to an entity (§30 parity). */
export const POST = route<{ id: string }>(async ({ principal, ip, userAgent, params, req }) => {
  const body = await req.json().catch(() => { throw new ServiceError("invalid_json", "Request body must be valid JSON", 400); });
  const { entityType, entityId } = body as { entityType?: string; entityId?: string };
  if (!entityType || !entityId) throw new ServiceError("missing_target", "entityType and entityId are required", 400);
  await attachFile({ principal, ip, userAgent }, params.id, entityType, entityId);
  return ok({ id: params.id, attached: true });
});

/** DELETE /api/v1/files/[id]/attach — detach a file from an entity (§30 parity). */
export const DELETE = route<{ id: string }>(async ({ principal, ip, userAgent, params, req }) => {
  const body = await req.json().catch(() => { throw new ServiceError("invalid_json", "Request body must be valid JSON", 400); });
  const { entityType, entityId } = body as { entityType?: string; entityId?: string };
  if (!entityType || !entityId) throw new ServiceError("missing_target", "entityType and entityId are required", 400);
  await detachFile({ principal, ip, userAgent }, params.id, entityType, entityId);
  return ok({ id: params.id, detached: true });
});
