import { route, ServiceError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { profitAndLoss } from "@/domain/accounting/reports";
export const GET = route(async ({ principal, req }) => {
  const q = Object.fromEntries(new URL(req.url).searchParams);
  if (!q.companyId) throw new ServiceError("missing_company", "companyId is required", 400);
  return ok(await profitAndLoss(principal, q));
});
