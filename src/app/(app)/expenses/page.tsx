import type { Metadata } from "next";
import type { Expense } from "@prisma/client";
import { Receipt } from "lucide-react";
import { pageGuard } from "@/lib/page-guard";
import { AccessDenied } from "@/components/access-denied";
import { canAnywhere } from "@/lib/permissions/engine";
import { PostExpenseButton } from "@/components/accounting/ap-controls";
import { listExpenses, expenseQuerySchema } from "@/domain/expenses";
import { getLookups, refName } from "@/domain/lookups";
import { StatusBadge, EmptyState, type Column } from "@/components/ui";
import { ResourceList } from "@/components/list/resource-list";
import { BrandChip } from "@/components/entity-chips";
import { formatCurrency, formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Expenses" };
import { getServerI18n } from "@/lib/server-i18n";

export default async function ExpensesPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const { principal, locale, denied } = await pageGuard("expenses.view");
  if (denied) return <AccessDenied locale={locale} />;
  const { t } = await getServerI18n();
  const sp = await searchParams;
  const query = expenseQuerySchema.parse(sp);
  const [{ rows, total, showValues }, lookups] = await Promise.all([listExpenses(principal, query), getLookups()]);
  const canPost = canAnywhere(principal, "accounting.post");

  const columns: Column<Expense>[] = [
    { key: "desc", header: t("common.description"), render: (e) => e.description ?? "—" },
    { key: "brand", header: t("common.brand"), render: (e) => <BrandChip name={refName(lookups.brands, e.brandId)} color={e.brandId ? lookups.brands.get(e.brandId)?.meta : null} /> },
    { key: "amount", header: t("common.amount"), align: "end", render: (e) => (showValues ? formatCurrency(e.amount, e.currency, locale) : "•••") },
    { key: "date", header: t("common.date"), align: "end", render: (e) => <span className="tabular text-ink-3">{formatDate(e.date, locale)}</span> },
    { key: "status", header: t("common.status"), render: (e) => <StatusBadge module="expense" status={e.status} /> },
    ...(canPost ? [{ key: "post", header: "", align: "end" as const, render: (e: Expense) => (e.status === "approved" && !e.journalEntryId ? <PostExpenseButton expenseId={e.id} /> : e.journalEntryId ? <span className="text-[11px] text-success">posted</span> : null) }] : []),
  ];

  return (
    <ResourceList title={t("expenses.title")} description={t("expenses.subtitle")} countLabel={t("expenses.count")} savedViewsModule="expenses"
      searchPlaceholder="Search expenses…"
      filters={[{ name: "status", label: t("common.status"), options: ["draft", "pending", "approved", "rejected", "paid"].map((v) => ({ value: v, label: t(`status.${v}`) })) }]}
      columns={columns} rows={rows} getRowKey={(e) => e.id}
      page={query.page} pageSize={query.pageSize} total={total} params={sp}
      empty={<EmptyState icon={<Receipt className="h-5 w-5" />} title={t("expenses.empty")} description={t("exp.subtitle")} />} />
  );
}
