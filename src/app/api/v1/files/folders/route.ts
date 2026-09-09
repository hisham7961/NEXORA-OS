import { route, ServiceError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { createFolder } from "@/domain/files";

/** POST /api/v1/files/folders — create a folder (§30 parity). */
export const POST = route(async ({ principal, ip, userAgent, req }) => {
  const body = await req.json().catch(() => { throw new ServiceError("invalid_json", "Request body must be valid JSON", 400); });
  return ok(await createFolder({ principal, ip, userAgent }, body));
});
