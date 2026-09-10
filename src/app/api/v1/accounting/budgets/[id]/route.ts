import { route, ServiceError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { getBudget, updateBudget, setBudgetStatus } from "@/domain/accounting/budgets";

export const GET = route<{ id: string }>(async ({ principal, params }) => {
  const b = await getBudget(principal, params.id);
  if (!b) throw new ServiceError("not_found", "Budget not found", 404);
  return ok(b);
});
export const PATCH = route<{ id: string }>(async ({ principal, ip, userAgent, params, req }) => {
  const body = await req.json().catch(() => { throw new ServiceError("invalid_json", "Invalid JSON", 400); });
  const status = (body as { status?: "draft" | "active" | "archived" }).status;
  if (status && Object.keys(body as object).length === 1) { return ok(await setBudgetStatus({ principal, ip, userAgent }, params.id, status)); }
  return ok(await updateBudget({ principal, ip, userAgent }, params.id, body));
});
