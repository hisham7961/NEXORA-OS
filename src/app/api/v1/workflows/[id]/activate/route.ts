import { route, ServiceError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { activateWorkflowVersion, validateWorkflowVersion } from "@/domain/workflows";

/** Validate a version without activating (dry run). ?versionId=... */
export const GET = route<{ id: string }>(async ({ principal, params, req }) => {
  const versionId = new URL(req.url).searchParams.get("versionId");
  if (!versionId) throw new ServiceError("missing_version", "versionId is required", 400);
  return ok(await validateWorkflowVersion(principal, params.id, versionId));
});

/** Activate a version (validates first; 422 with errors if invalid). */
export const POST = route<{ id: string }>(async ({ principal, ip, userAgent, params, req }) => {
  const body = await req.json().catch(() => { throw new ServiceError("invalid_json", "Request body must be valid JSON", 400); });
  const versionId = (body as { versionId?: string }).versionId;
  if (!versionId) throw new ServiceError("missing_version", "versionId is required", 400);
  await activateWorkflowVersion({ principal, ip, userAgent }, params.id, versionId);
  return ok({ id: params.id, versionId, activated: true });
});
