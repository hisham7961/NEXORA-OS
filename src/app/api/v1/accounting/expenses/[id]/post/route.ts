import { route, ServiceError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { postExpense } from "@/domain/accounting/expenses-gl";

export const POST = route<{ id: string }>(async ({ principal, ip, userAgent, params, req }) => {
  const body = await req.json().catch(() => ({}));
  const { expenseAccountId, paymentAccountId } = body as { expenseAccountId?: string; paymentAccountId?: string };
  return ok(await postExpense({ principal, ip, userAgent }, params.id, { expenseAccountId, paymentAccountId }));
});
