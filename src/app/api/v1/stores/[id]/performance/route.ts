import { route, ServiceError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { recordStorePerformance } from "@/domain/stores";

/** POST /api/v1/stores/:id/performance — record (or upsert) a period's figures. */
export const POST = route<{ id: string }>(async ({ principal, ip, userAgent, params, req }) => {
  const body = await req.json().catch(() => {
    throw new ServiceError("invalid_json", "Request body must be valid JSON", 400);
  });
  const row = await recordStorePerformance({ principal, ip, userAgent }, params.id, body);
  return ok(row);
});
