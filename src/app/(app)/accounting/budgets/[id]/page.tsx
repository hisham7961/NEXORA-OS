import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { pageGuard } from "@/lib/page-guard";
import { AccessDenied } from "@/components/access-denied";
import { canAnywhere, ForbiddenError } from "@/lib/permissions/engine";
import { getBudget, budgetVsActual } from "@/domain/accounting/budgets";
import { PageHeader, Panel, PanelHeader, DataTable, Badge, type Column } from "@/components/ui";
import { BudgetStatusButton } from "@/components/accounting/budget-controls";

export const metadata: Metadata = { title: "Budget" };

export default async function BudgetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { principal, locale, denied } = await pageGuard("budgets.view");
  if (denied) return <AccessDenied locale={locale} />;
  const { id } = await params;
  let budget;
  try { budget = await getBudget(principal, id); } catch (e) { if (e instanceof ForbiddenError) return <AccessDenied locale={locale} />; throw e; }
  if (!budget) notFound();
  const report = await budgetVsActual(principal, id);
  const num = (v: unknown) => Number(v).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 3 });
  const canManage = canAnywhere(principal, "budgets.manage");

  type Row = (typeof report.rows)[number];
  const columns: Column<Row>[] = [
    { key: "code", header: "Account", render: (r) => <span className="text-ink"><span className="font-mono text-ink-3">{r.code}</span> {r.name}</span> },
    { key: "budget", header: "Budget", align: "end", render: (r) => <span className="tabular text-ink-2">{num(r.budget)}</span> },
    { key: "actual", header: "Actual", align: "end", render: (r) => <span className="tabular text-ink-2">{num(r.actual)}</span> },
    { key: "variance", header: "Variance", align: "end", render: (r) => { const v = Number(r.variance); return <span className={`tabular ${v < 0 ? "text-critical" : "text-success"}`}>{num(r.variance)}</span>; } },
    { key: "pct", header: "% used", align: "end", render: (r) => <span className="tabular text-ink-3">{r.pctUsed != null ? `${r.pctUsed}%` : "—"}</span> },
  ];

  return (
    <>
      <div className="mb-1 text-xs text-ink-3"><Link href={`/accounting/budgets?company=${budget.companyId}`} className="hover:text-ink-2">Budgets</Link> / {budget.name}</div>
      <PageHeader title={budget.name} description={`Budget vs actual${report.from ? ` · ${report.from.toISOString().slice(0, 10)} → ${report.to?.toISOString().slice(0, 10)}` : ""}`}
        meta={<Badge category={budget.status === "active" ? "success" : "neutral"}>{budget.status}</Badge>}
        actions={<div className="flex items-center gap-2">{canManage && <><Link href={`/accounting/budgets/${budget.id}/edit`} className="text-[12px] text-accent hover:underline">Edit</Link><BudgetStatusButton id={budget.id} status={budget.status} /></>}</div>} />
      <Panel>
        <PanelHeader title="Budget vs Actual" />
        <DataTable columns={columns} rows={report.rows} getRowKey={(r) => r.accountId} />
        <div className="flex flex-wrap justify-end gap-8 border-t border-line px-4 py-2 text-[13px] font-medium">
          <span>Budget <span className="ms-1 tabular text-ink">{num(report.totalBudget)}</span></span>
          <span>Actual <span className="ms-1 tabular text-ink">{num(report.totalActual)}</span></span>
          <span>Variance <span className={`ms-1 tabular ${Number(report.totalVariance) < 0 ? "text-critical" : "text-success"}`}>{num(report.totalVariance)} {budget.currency}</span></span>
        </div>
      </Panel>
    </>
  );
}
