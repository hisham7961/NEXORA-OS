import { route, ServiceError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { getSettingsForAdmin, updateSetting } from "@/domain/settings";

export const GET = route(async ({ principal }) => {
  return ok(await getSettingsForAdmin(principal));
});
export const PATCH = route(async ({ principal, ip, userAgent, req }) => {
  const body = await req.json().catch(() => { throw new ServiceError("invalid_json", "Invalid JSON", 400); });
  const { key, value } = body as { key?: string; value?: unknown };
  if (!key) throw new ServiceError("missing_key", "key is required", 400);
  return ok(await updateSetting({ principal, ip, userAgent }, key, value));
});
