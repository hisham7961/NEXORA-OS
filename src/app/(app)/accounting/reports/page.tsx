import type { Metadata } from "next";
import { Scale } from "lucide-react";
import { pageGuard } from "@/lib/page-guard";
import { getServerI18n } from "@/lib/server-i18n";
import { AccessDenied } from "@/components/access-denied";
import { resolveAccountingCompany } from "@/domain/accounting/access";
import { trialBalance, profitAndLoss, balanceSheet } from "@/domain/accounting/reports";
import { arAging } from "@/domain/accounting/ar";
import { apAging } from "@/domain/accounting/ap";
import { cashFlow } from "@/domain/accounting/statements";
import Link from "next/link";
import { PageHeader, Panel, PanelHeader, PanelBody, DataTable, Badge, EmptyState, Metric, type Column } from "@/components/ui";
import { CompanyPicker } from "@/components/accounting/company-picker";
import { ExportButton } from "@/components/list/export-button";

export const metadata: Metadata = { title: "Financial Reports" };

function money(v: string, locale: string) { const n = Number(v); return n === 0 ? "—" : n.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 3 }); }

export default async function AccountingReportsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const { principal, locale, denied } = await pageGuard("accounting.view");
  if (denied) return <AccessDenied locale={locale} />;
  const { t } = await getServerI18n();
  const sp = await searchParams;
  const { companies, current } = await resolveAccountingCompany(principal, sp.company);
  if (!current) return <><PageHeader title={t("acct.reports")} /><Panel><EmptyState title={t("acct.noCompany")} /></Panel></>;
  const tab = sp.tab ?? "trial-balance";
  const cur = current.baseCurrency;

  const tabs = [
    { key: "trial-balance", label: t("acct.rep.trialBalance") },
    { key: "profit-loss", label: t("acct.rep.pl") },
    { key: "balance-sheet", label: t("acct.rep.balanceSheet") },
    { key: "ar-aging", label: t("acct.rep.arAging") },
    { key: "ap-aging", label: t("acct.rep.apAging") },
    { key: "cash-flow", label: t("acct.rep.cashFlow") },
  ];

  return (
    <>
      <PageHeader title={t("acct.reports")} description={`Derived only from posted ledger data for ${current.name} (${cur}).`}
        actions={<div className="flex items-center gap-2"><CompanyPicker companies={companies} current={current.id} />{["trial-balance", "ar-aging", "ap-aging"].includes(tab) && <ExportButton resource={tab} />}</div>} />
      <div className="mb-4 flex gap-1 border-b border-line">
        {tabs.map((tb) => (
          <Link key={tb.key} href={`/accounting/reports?company=${current.id}&tab=${tb.key}`}
            className={`-mb-px border-b-2 px-3 py-2 text-[13px] ${tab === tb.key ? "border-accent font-medium text-ink" : "border-transparent text-ink-3 hover:text-ink-2"}`}>{tb.label}</Link>
        ))}
      </div>

      {tab === "trial-balance" && await (async () => {
        const tb = await trialBalance(principal, current.id);
        const columns: Column<(typeof tb.rows)[number]>[] = [
          { key: "code", header: t("common.code"), render: (r) => <span className="font-mono text-ink-3">{r.code}</span> },
          { key: "name", header: t("acct.col.account"), render: (r) => r.name },
          { key: "debit", header: t("acct.col.debit"), align: "end", render: (r) => <span className="tabular">{money(r.debit, locale)}</span> },
          { key: "credit", header: t("acct.col.credit"), align: "end", render: (r) => <span className="tabular">{money(r.credit, locale)}</span> },
        ];
        return (
          <Panel>
            <PanelHeader title="Trial Balance" icon={<Scale className="h-4 w-4" />} action={<Badge category={tb.balanced ? "success" : "critical"}>{tb.balanced ? "Balanced" : "Out of balance"}</Badge>} />
            <DataTable columns={columns} rows={tb.rows} getRowKey={(r) => r.accountId} empty={<EmptyState title="No postings" description="Post journal entries to populate the trial balance." />} />
            <div className="flex justify-end gap-8 border-t border-line px-4 py-2 text-[13px] font-medium">
              <span>{t("common.total")} Debit <span className="ms-2 tabular text-ink">{money(tb.totalDebit, locale)} {cur}</span></span>
              <span>{t("common.total")} Credit <span className="ms-2 tabular text-ink">{money(tb.totalCredit, locale)} {cur}</span></span>
            </div>
          </Panel>
        );
      })()}

      {tab === "profit-loss" && await (async () => {
        const pl = await profitAndLoss(principal, { companyId: current.id });
        const Row = ({ label, value, strong }: { label: string; value: string; strong?: boolean }) => (
          <div className={`flex items-center justify-between px-4 py-2 ${strong ? "border-t border-line font-semibold text-ink" : "text-ink-2"}`}><span>{label}</span><span className="tabular">{money(value, locale)} {cur}</span></div>
        );
        return (
          <Panel>
            <PanelHeader title="Profit & Loss" />
            <div className="divide-y divide-line">
              <Row label="Revenue" value={pl.revenue} />
              <Row label="Cost of Sales" value={pl.cogs} />
              <Row label="Gross Profit" value={pl.grossProfit} strong />
              <Row label="Operating Expenses" value={pl.operatingExpense} />
              <Row label="Operating Profit" value={pl.operatingProfit} strong />
              <Row label="Other Income" value={pl.otherIncome} />
              <Row label="Other Expense" value={pl.otherExpense} />
              <Row label="Net Profit" value={pl.netProfit} strong />
            </div>
          </Panel>
        );
      })()}

      {tab === "balance-sheet" && await (async () => {
        const bs = await balanceSheet(principal, current.id);
        return (
          <Panel>
            <PanelHeader title="Balance Sheet" action={<Badge category={bs.balanced ? "success" : "critical"}>{bs.balanced ? "Balanced" : "Out of balance"}</Badge>} />
            <PanelBody>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Metric label="Assets" value={`${money(bs.assets, locale)} ${cur}`} category="info" />
                <Metric label="Liabilities" value={`${money(bs.liabilities, locale)} ${cur}`} category="warning" />
                <Metric label="Equity (incl. earnings)" value={`${money(bs.totalEquity, locale)} ${cur}`} category="success" />
              </div>
              <p className="mt-3 text-[12px] text-ink-3">Assets {money(bs.assets, locale)} = Liabilities {money(bs.liabilities, locale)} + Equity {money(bs.totalEquity, locale)} (of which current-period earnings {money(bs.currentEarnings, locale)}).</p>
            </PanelBody>
          </Panel>
        );
      })()}

      {tab === "ar-aging" && await (async () => {
        const aging = await arAging(principal, current.id);
        const columns: Column<(typeof aging.rows)[number]>[] = [
          { key: "name", header: t("acct.col.customer"), render: (r) => <span className="text-ink">{r.name}</span> },
          { key: "current", header: t("acct.col.current"), align: "end", render: (r) => <span className="tabular text-ink-2">{money(String(r.current), locale)}</span> },
          { key: "d30", header: "1–30", align: "end", render: (r) => <span className="tabular text-ink-2">{money(String(r.d30), locale)}</span> },
          { key: "d60", header: "31–60", align: "end", render: (r) => <span className="tabular text-warning">{money(String(r.d60), locale)}</span> },
          { key: "d90", header: "61–90", align: "end", render: (r) => <span className="tabular text-warning">{money(String(r.d90), locale)}</span> },
          { key: "older", header: "90+", align: "end", render: (r) => <span className="tabular text-critical">{money(String(r.older), locale)}</span> },
          { key: "total", header: t("common.total"), align: "end", render: (r) => <span className="tabular font-medium text-ink">{money(String(r.total), locale)}</span> },
        ];
        const tot = aging.totals;
        return (
          <Panel>
            <PanelHeader title={t("acct.arAgingTitle")} action={<Badge category="info">{aging.rows.length} customers</Badge>} />
            <DataTable columns={columns} rows={aging.rows} getRowKey={(r) => r.customerId} empty={<EmptyState title={t("acct.noReceivables")} description={t("acct.allSettledInv")} />} />
            <div className="flex flex-wrap justify-end gap-6 border-t border-line px-4 py-2 text-[13px] font-medium">
              <span>{t("acct.col.current")} <span className="ms-1 tabular text-ink">{money(String(tot.current), locale)}</span></span>
              <span>1–30 <span className="ms-1 tabular text-ink">{money(String(tot.d30), locale)}</span></span>
              <span>31–60 <span className="ms-1 tabular text-ink">{money(String(tot.d60), locale)}</span></span>
              <span>61–90 <span className="ms-1 tabular text-ink">{money(String(tot.d90), locale)}</span></span>
              <span>90+ <span className="ms-1 tabular text-ink">{money(String(tot.older), locale)}</span></span>
              <span>{t("common.total")} <span className="ms-1 tabular text-ink">{money(String(tot.total), locale)} {cur}</span></span>
            </div>
          </Panel>
        );
      })()}

      {tab === "ap-aging" && await (async () => {
        const aging = await apAging(principal, current.id);
        const columns: Column<(typeof aging.rows)[number]>[] = [
          { key: "name", header: t("acct.col.supplier"), render: (r) => <span className="text-ink">{r.name}</span> },
          { key: "current", header: t("acct.col.current"), align: "end", render: (r) => <span className="tabular text-ink-2">{money(String(r.current), locale)}</span> },
          { key: "d30", header: "1–30", align: "end", render: (r) => <span className="tabular text-ink-2">{money(String(r.d30), locale)}</span> },
          { key: "d60", header: "31–60", align: "end", render: (r) => <span className="tabular text-warning">{money(String(r.d60), locale)}</span> },
          { key: "d90", header: "61–90", align: "end", render: (r) => <span className="tabular text-warning">{money(String(r.d90), locale)}</span> },
          { key: "older", header: "90+", align: "end", render: (r) => <span className="tabular text-critical">{money(String(r.older), locale)}</span> },
          { key: "total", header: t("common.total"), align: "end", render: (r) => <span className="tabular font-medium text-ink">{money(String(r.total), locale)}</span> },
        ];
        const tot = aging.totals;
        return (
          <Panel>
            <PanelHeader title={t("acct.apAgingTitle")} action={<Badge category="info">{aging.rows.length} suppliers</Badge>} />
            <DataTable columns={columns} rows={aging.rows} getRowKey={(r) => r.supplierId} empty={<EmptyState title={t("acct.noPayables")} description={t("acct.allSettledBills")} />} />
            <div className="flex flex-wrap justify-end gap-6 border-t border-line px-4 py-2 text-[13px] font-medium">
              <span>{t("acct.col.current")} <span className="ms-1 tabular text-ink">{money(String(tot.current), locale)}</span></span>
              <span>1–30 <span className="ms-1 tabular text-ink">{money(String(tot.d30), locale)}</span></span>
              <span>31–60 <span className="ms-1 tabular text-ink">{money(String(tot.d60), locale)}</span></span>
              <span>61–90 <span className="ms-1 tabular text-ink">{money(String(tot.d90), locale)}</span></span>
              <span>90+ <span className="ms-1 tabular text-ink">{money(String(tot.older), locale)}</span></span>
              <span>{t("common.total")} <span className="ms-1 tabular text-ink">{money(String(tot.total), locale)} {cur}</span></span>
            </div>
          </Panel>
        );
      })()}

      {tab === "cash-flow" && await (async () => {
        const yr = new Date().getFullYear();
        const cf = await cashFlow(principal, current.id, new Date(yr, 0, 1), new Date());
        const catLabel: Record<string, string> = { operating: "Operating", investing: "Investing", financing: "Financing" };
        return (
          <Panel>
            <PanelHeader title="Cash Flow (direct method)" action={<Badge category="info">YTD</Badge>} />
            <PanelBody>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Metric label="Opening cash" value={`${money(cf.opening, locale)} ${cur}`} />
                <Metric label="Net change" value={`${money(cf.netChange, locale)} ${cur}`} category={Number(cf.netChange) >= 0 ? "success" : "critical"} />
                <Metric label="Closing cash" value={`${money(cf.closing, locale)} ${cur}`} category="info" />
              </div>
              <div className="mt-4 space-y-3">
                {["operating", "investing", "financing"].map((cat) => {
                  const rows = cf.rows.filter((r) => r.category === cat);
                  if (rows.length === 0) return null;
                  const net = cf.categories.find((c) => c.category === cat)?.net ?? "0";
                  return (
                    <div key={cat} className="rounded-lg border border-line">
                      <div className="flex items-center justify-between border-b border-line px-3 py-1.5 text-[12px] font-medium text-ink-2">{catLabel[cat]} activities<span className="tabular">{money(net, locale)}</span></div>
                      <div className="divide-y divide-line">
                        {rows.map((r) => <div key={r.accountId} className="flex items-center justify-between px-3 py-1.5 text-[13px]"><span className="text-ink-2"><span className="font-mono text-ink-3">{r.code}</span> {r.name}</span><span className={`tabular ${Number(r.flow) >= 0 ? "text-success" : "text-critical"}`}>{money(r.flow, locale)}</span></div>)}
                      </div>
                    </div>
                  );
                })}
                {cf.rows.length === 0 && <p className="text-[13px] text-ink-3">No cash movements in the period.</p>}
              </div>
            </PanelBody>
          </Panel>
        );
      })()}
    </>
  );
}
