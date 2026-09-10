import { route, ServiceError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { listFavorites, toggleFavorite } from "@/domain/personal";

export const GET = route(async ({ principal }) => ok(await listFavorites(principal)));
export const POST = route(async ({ principal, ip, userAgent, req }) => {
  const body = await req.json().catch(() => { throw new ServiceError("invalid_json", "Invalid JSON", 400); });
  return ok(await toggleFavorite({ principal, ip, userAgent }, body));
});
