import { route, ServiceError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { listSavedViews, saveView } from "@/domain/personal";

export const GET = route(async ({ principal, req }) => {
  const module = new URL(req.url).searchParams.get("module");
  if (!module) throw new ServiceError("missing_module", "module is required", 400);
  return ok(await listSavedViews(principal, module));
});
export const POST = route(async ({ principal, ip, userAgent, req }) => {
  const body = await req.json().catch(() => { throw new ServiceError("invalid_json", "Invalid JSON", 400); });
  return ok(await saveView({ principal, ip, userAgent }, body));
});
