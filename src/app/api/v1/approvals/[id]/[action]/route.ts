import { route, ServiceError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { decideApproval, cancelApprovalRequest } from "@/domain/approvals";

const DECISIONS: Record<string, "approved" | "rejected" | "changes"> = {
  approve: "approved",
  reject: "rejected",
  "request-changes": "changes",
};

/**
 * POST /api/v1/approvals/:id/approve | reject | request-changes | cancel
 * Same domain logic as the web app (Part U parity).
 */
export const POST = route<{ id: string; action: string }>(async ({ principal, ip, userAgent, params, req }) => {
  const ctx = { principal, ip, userAgent };
  if (params.action === "cancel") {
    await cancelApprovalRequest(ctx, params.id);
    return ok({ cancelled: true });
  }
  const decision = DECISIONS[params.action];
  if (!decision) throw new ServiceError("bad_action", "Unknown approval action", 400);
  const body = await req.json().catch(() => ({}));
  const request = await decideApproval(ctx, params.id, decision, typeof body?.comment === "string" ? body.comment : undefined);
  return ok(request);
});
