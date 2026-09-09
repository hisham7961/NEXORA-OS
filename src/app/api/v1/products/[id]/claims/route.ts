import { route, ServiceError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { addProductClaim, approveProductClaim } from "@/domain/products";

/** POST /api/v1/products/[id]/claims — add a claim, or approve one via {claimId}. */
export const POST = route<{ id: string }>(async ({ principal, ip, userAgent, params, req }) => {
  const body = await req.json().catch(() => { throw new ServiceError("invalid_json", "Request body must be valid JSON", 400); });
  const b = body as { claim?: string; countryId?: string; claimId?: string };
  const ctx = { principal, ip, userAgent };
  if (b.claimId) { await approveProductClaim(ctx, params.id, b.claimId); return ok({ id: params.id, approved: b.claimId }); }
  if (!b.claim) throw new ServiceError("missing_claim", "claim or claimId is required", 400);
  await addProductClaim(ctx, params.id, { claim: b.claim, countryId: b.countryId });
  return ok({ id: params.id, added: true });
});
