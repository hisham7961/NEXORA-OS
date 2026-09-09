import { route, ServiceError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { getRegistration, updateRegistration } from "@/domain/registrations";

export const GET = route<{ id: string }>(async ({ principal, params }) => {
  const data = await getRegistration(principal, params.id);
  if (!data) throw new ServiceError("not_found", "Registration not found", 404);
  return ok(data);
});

export const PATCH = route<{ id: string }>(async ({ principal, ip, userAgent, params, req }) => {
  const body = await req.json().catch(() => { throw new ServiceError("invalid_json", "Request body must be valid JSON", 400); });
  return ok(await updateRegistration({ principal, ip, userAgent }, params.id, body));
});
