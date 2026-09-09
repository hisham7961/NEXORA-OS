import { route, ServiceError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { getCase, updateCase } from "@/domain/cases";

/** GET /api/v1/cases/:id — single case, fail-closed on scope. */
export const GET = route<{ id: string }>(async ({ principal, params }) => {
  const c = await getCase(principal, params.id);
  if (!c) throw new ServiceError("not_found", "Case not found", 404);
  return ok(c);
});

/** PATCH /api/v1/cases/:id — update fields / status / assignee. */
export const PATCH = route<{ id: string }>(async ({ principal, ip, userAgent, params, req }) => {
  const body = await req.json().catch(() => {
    throw new ServiceError("invalid_json", "Request body must be valid JSON", 400);
  });
  const c = await updateCase({ principal, ip, userAgent }, params.id, body);
  return ok(c);
});
