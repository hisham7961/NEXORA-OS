import { route, ServiceError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { getFile, updateFileMeta } from "@/domain/files";

/** GET /api/v1/files/:id */
export const GET = route<{ id: string }>(async ({ principal, params }) => {
  const f = await getFile(principal, params.id);
  if (!f) throw new ServiceError("not_found", "File not found", 404);
  return ok(f);
});

/** PATCH /api/v1/files/:id — metadata (name/description/category/tags/folder/visibility). */
export const PATCH = route<{ id: string }>(async ({ principal, ip, userAgent, params, req }) => {
  const body = await req.json().catch(() => { throw new ServiceError("invalid_json", "Request body must be valid JSON", 400); });
  const f = await updateFileMeta({ principal, ip, userAgent }, params.id, body);
  return ok(f);
});
