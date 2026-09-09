import { route, ServiceError } from "@/lib/api/handler";
import { ok, created } from "@/lib/api/response";
import { pageMeta } from "@/lib/api/pagination";
import { listApprovals, createApprovalRequest, approvalQuerySchema } from "@/domain/approvals";

/** GET /api/v1/approvals — scoped list. */
export const GET = route(async ({ principal, req }) => {
  const query = approvalQuerySchema.parse(Object.fromEntries(new URL(req.url).searchParams));
  const { rows, total } = await listApprovals(principal, query);
  return ok(rows, pageMeta(total, query));
});

/** POST /api/v1/approvals — submit a request for approval. */
export const POST = route(async ({ principal, ip, userAgent, req }) => {
  const body = await req.json().catch(() => {
    throw new ServiceError("invalid_json", "Request body must be valid JSON", 400);
  });
  const r = await createApprovalRequest({ principal, ip, userAgent }, body);
  return created({ id: r.id });
});
