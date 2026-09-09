import { route, ServiceError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { createDepartment } from "@/domain/org-admin";
export const POST = route(async ({ principal, ip, userAgent, req }) => {
  const body = await req.json().catch(() => { throw new ServiceError("invalid_json", "Request body must be valid JSON", 400); });
  return ok(await createDepartment({ principal, ip, userAgent }, body));
});
