import { route, ServiceError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { addRequirement } from "@/domain/registrations";

/** POST /api/v1/registrations/[id]/requirements — add a required document (§30 parity). */
export const POST = route<{ id: string }>(async ({ principal, ip, userAgent, params, req }) => {
  const body = await req.json().catch(() => { throw new ServiceError("invalid_json", "Request body must be valid JSON", 400); });
  const name = (body as { name?: string }).name;
  if (!name) throw new ServiceError("missing_name", "name is required", 400);
  await addRequirement({ principal, ip, userAgent }, params.id, name, (body as { documentTypeId?: string }).documentTypeId);
  return ok({ id: params.id, added: true });
});
