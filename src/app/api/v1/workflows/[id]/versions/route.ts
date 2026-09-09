import { route, ServiceError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { getWorkflow, saveWorkflowDraft, openWorkflowRevision } from "@/domain/workflows";

/** List a workflow's versions (newest first). */
export const GET = route<{ id: string }>(async ({ principal, params }) => {
  const def = await getWorkflow(principal, params.id);
  if (!def) throw new ServiceError("not_found", "Workflow not found", 404);
  return ok((def as { versions?: unknown }).versions ?? []);
});

/** Open a new draft revision. */
export const POST = route<{ id: string }>(async ({ principal, ip, userAgent, params }) => {
  return ok(await openWorkflowRevision({ principal, ip, userAgent }, params.id));
});

/** Save the current draft's spec (returns validation result). */
export const PUT = route<{ id: string }>(async ({ principal, ip, userAgent, params, req }) => {
  const body = await req.json().catch(() => { throw new ServiceError("invalid_json", "Request body must be valid JSON", 400); });
  const spec = (body as { spec?: unknown }).spec ?? body;
  const changeNote = (body as { changeNote?: string }).changeNote;
  const result = await saveWorkflowDraft({ principal, ip, userAgent }, params.id, spec, changeNote);
  return ok(result);
});
