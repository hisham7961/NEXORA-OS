import { route, ServiceError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { listThread } from "@/domain/discussions";

/** GET /api/v1/discussions/:id/thread?parent= — replies within a thread. */
export const GET = route<{ id: string }>(async ({ principal, params, req }) => {
  const parent = new URL(req.url).searchParams.get("parent");
  if (!parent) throw new ServiceError("bad_request", "parent is required", 400);
  return ok(await listThread(principal, params.id, parent));
});
