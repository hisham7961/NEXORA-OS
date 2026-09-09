import { route, ServiceError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { approveDesignVersion, rejectDesignVersion } from "@/domain/design";

/** POST /api/v1/design/[id]/versions/[versionId]/decision — approve/reject a version (§30 parity). */
export const POST = route<{ id: string; versionId: string }>(async ({ principal, ip, userAgent, params, req }) => {
  const body = await req.json().catch(() => { throw new ServiceError("invalid_json", "Request body must be valid JSON", 400); });
  const decision = (body as { decision?: string }).decision;
  const ctx = { principal, ip, userAgent };
  if (decision === "approve") { await approveDesignVersion(ctx, params.id, params.versionId); }
  else if (decision === "reject") { await rejectDesignVersion(ctx, params.id, params.versionId, (body as { note?: string }).note); }
  else throw new ServiceError("bad_decision", "decision must be 'approve' or 'reject'", 400);
  return ok({ id: params.id, versionId: params.versionId, decision });
});
