import { route, ServiceError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { budgetVsActual } from "@/domain/accounting/budgets";

export const GET = route(async ({ principal, req }) => {
  const u = new URL(req.url); const budgetId = u.searchParams.get("budgetId");
  if (!budgetId) throw new ServiceError("missing_budget", "budgetId is required", 400);
  return ok(await budgetVsActual(principal, budgetId));
});
