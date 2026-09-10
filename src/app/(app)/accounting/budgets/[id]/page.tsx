import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { pageGuard } from "@/lib/page-guard";
import { getServerI18n } from "@/lib/server-i18n";
import { AccessDenied } from "@/components/access-denied";
import { canAnywhere, ForbiddenError } from "@/lib/permissions/engine";
import { getBudget, budgetVsActual, budgetVsActualMonthly } from "@/domain/accounting/budgets";
import { PageHeader, Panel, PanelHeader, DataTable, Badge, type Column } from "@/components/ui";
import { BudgetStatusButton } from "@/components/accounting/budget-controls";

export const metadata: Metadata = { title: "Budget" };

export default async function BudgetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { principal, locale, denied } = await pageGuard("budgets.view");
  if (denied) return <AccessDenied locale={locale} />;
  const { t } = await getServerI18n();
  const { id } = await params;
  let budget;
  try { budget = await getBudget(principal, id); } catch (e) { if (e instanceof ForbiddenError) return <AccessDenied locale={locale} />; throw e; }
  if (!budget) notFound();
  const periodized = budget.periodicity !== "annual";
  const report = await budgetVsActual(principal, id);
  const monthly = periodized ? await budgetVsActualMonthly(principal, id) : null;
  const num = (v: unknown) => Number(v).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 3 });
  const MONTHS = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];
  const canManage = canAnywhere(principal, "budgets.manage");

  type Row = (typeof report.rows)[number];
  const columns: Column<Row>[] = [
    { key: "code", header: t("acct.col.account"), render: (r) => <span className="text-ink"><span className="font-mono text-ink-3">{r.code}</span> {r.name}</span> },
    { key: "budget", header: t("acct.col.budget"), align: "end", render: (r) => <span className="tabular text-ink-2">{num(r.budget)}</span> },
    { key: "actual", header: t("acct.budgetActual"), align: "end", render: (r) => <span className="tabular text-ink-2">{num(r.actual)}</span> },
    { key: "variance", header: t("acct.budgetVariance"), align: "end", render: (r) => { const v = Number(r.variance); return <span className={`tabular ${v < 0 ? "text-critical" : "text-success"}`}>{num(r.variance)}</span>; } },
    { key: "pct", header: t("acct.pctUsed"), align: "end", render: (r) => <span className="tabular text-ink-3">{r.pctUsed != null ? `${r.pctUsed}%` : "—"}</span> },
  ];

  return (
    <>
      <div className="mb-1 text-xs text-ink-3"><Link href={`/accounting/budgets?company=${budget.companyId}`} className="hover:text-ink-2">{t("acct.budgetsNav")}</Link> / {budget.name}</div>
      <PageHeader title={budget.name} description={`${t("acct.budgetVsActualSub")}${report.from ? ` · ${report.from.toISOString().slice(0, 10)} → ${report.to?.toISOString().slice(0, 10)}` : ""}`}
        meta={<Badge category={budget.status === "active" ? "success" : "neutral"}>{t(`status.${budget.status}`)}</Badge>}
        actions={<div className="flex items-center gap-2">{canManage && <><Link href={`/accounting/budgets/${budget.id}/edit`} className="text-[12px] text-accent hover:underline">{t("actions.edit")}</Link><BudgetStatusButton id={budget.id} status={budget.status} /></>}</div>} />
      <Panel>
        <PanelHeader title={t("acct.rep.budgetVsActual")} />
        <DataTable columns={columns} rows={report.rows} getRowKey={(r) => r.accountId} />
        <div className="flex flex-wrap justify-end gap-8 border-t border-line px-4 py-2 text-[13px] font-medium">
          <span>{t("acct.col.budget")} <span className="ms-1 tabular text-ink">{num(report.totalBudget)}</span></span>
          <span>{t("acct.budgetActual")} <span className="ms-1 tabular text-ink">{num(report.totalActual)}</span></span>
          <span>{t("acct.budgetVariance")} <span className={`ms-1 tabular ${Number(report.totalVariance) < 0 ? "text-critical" : "text-success"}`}>{num(report.totalVariance)} {budget.currency}</span></span>
        </div>
      </Panel>

      {monthly && (
        <Panel className="mt-4">
          <PanelHeader title={t("acct.rep.monthlyBudgetVsActual")} description={t("acct.monthlyBvaSub", { periodicity: budget.periodicity })} />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-[12px]">
              <thead>
                <tr className="border-b border-line text-ink-3">
                  <th className="px-2 py-2 text-start font-medium">{t("acct.col.account")}</th>
                  {MONTHS.map((m) => <th key={m} className="px-2 py-2 text-end font-medium">{t(`acct.month.${m}`)}</th>)}
                  <th className="px-2 py-2 text-end font-medium">{t("acct.ytdVar")}</th>
                </tr>
              </thead>
              <tbody>
                {monthly.rows.map((r) => (
                  <tr key={r.accountId} className="border-b border-line last:border-0 align-top">
                    <td className="px-2 py-1.5 text-ink"><span className="font-mono text-ink-3">{r.code}</span> {r.name}</td>
                    {r.months.map((m) => {
                      const v = Number(m.variance);
                      return <td key={m.month} className={`px-2 py-1.5 text-end tabular ${m.month === monthly.currentMonth ? "bg-surface-2" : ""}`}>
                        <div className="text-ink-2">{Number(m.actual) ? num(m.actual) : "·"}</div>
                        <div className={`text-[10px] ${v < 0 ? "text-critical" : "text-ink-3"}`}>{t("acct.budgetShort")} {Number(m.budget) ? num(m.budget) : "·"}</div>
                      </td>;
                    })}
                    <td className={`px-2 py-1.5 text-end tabular font-medium ${Number(r.ytdVariance) < 0 ? "text-critical" : "text-success"}`}>{num(r.ytdVariance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="px-4 py-2 text-[11px] text-ink-3">{t("acct.bvaFootnote")}</p>
        </Panel>
      )}
    </>
  );
}
