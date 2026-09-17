import type { Metadata } from "next";
import { BarChart4 } from "lucide-react";
import Link from "next/link";
import { pageGuard } from "@/lib/page-guard";
import { getServerI18n } from "@/lib/server-i18n";
import { AccessDenied } from "@/components/access-denied";
import { resolveAccountingCompany } from "@/domain/accounting/access";
import { companyFinancialOverview, dimensionPnl, type PnlDimension } from "@/domain/accounting/intelligence";
import { PageHeader, Panel, PanelHeader, DataTable, Badge, EmptyState, Metric, type Column } from "@/components/ui";
import { CompanyPicker } from "@/components/accounting/company-picker";

export const metadata: Metadata = { title: "Financial Intelligence" };

const DIMS: { key: PnlDimension; labelKey: string }[] = [
  { key: "brand", labelKey: "common.brand" }, { key: "country", labelKey: "common.country" }, { key: "product", labelKey: "fin.dim.product" },
  { key: "store", labelKey: "fin.dim.store" }, { key: "campaign", labelKey: "fin.dim.campaign" }, { key: "department", labelKey: "fin.dim.department" },
];

export default async function IntelligencePage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const { principal, locale, denied } = await pageGuard("accounting.view");
  if (denied) return <AccessDenied locale={locale} />;
  const { t } = await getServerI18n();
  const sp = await searchParams;
  const { companies, current } = await resolveAccountingCompany(principal, sp.company);
  if (!current) return <><PageHeader title={t("acct.intelligence")} /><Panel><EmptyState title={t("acct.noCompany")} /></Panel></>;
  const dim = (DIMS.find((d) => d.key === sp.dim)?.key ?? "brand") as PnlDimension;
  const cur = current.baseCurrency;
  const dimLabel = (k: PnlDimension) => t(DIMS.find((d) => d.key === k)?.labelKey ?? "fin.dim.dimension");

  const [overview, pnl] = await Promise.all([
    companyFinancialOverview(principal, current.id),
    dimensionPnl(principal, current.id, dim, { from: new Date(new Date().getFullYear(), 0, 1), to: new Date() }),
  ]);
  const num = (v: unknown) => Number(v).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 3 });

  type Row = (typeof pnl.rows)[number];
  const columns: Column<Row>[] = [
    { key: "name", header: dimLabel(dim), render: (r) => <span className="text-ink">{r.name}</span> },
    { key: "revenue", header: t("acct.intel.revenue"), align: "end", render: (r) => <span className="tabular text-ink-2">{num(r.revenue)}</span> },
    { key: "gross", header: t("acct.intel.grossProfit"), align: "end", render: (r) => <span className="tabular text-ink-2">{num(r.grossProfit)}</span> },
    { key: "expense", header: t("acct.intel.expenses"), align: "end", render: (r) => <span className="tabular text-ink-3">{num(r.expense)}</span> },
    { key: "net", header: t("acct.intel.netProfit"), align: "end", render: (r) => { const v = Number(r.netProfit); return <span className={`tabular font-medium ${v < 0 ? "text-critical" : "text-success"}`}>{num(r.netProfit)}</span>; } },
    { key: "margin", header: t("acct.intel.margin"), align: "end", render: (r) => <span className="tabular text-ink-3">{r.margin != null ? `${r.margin}%` : "—"}</span> },
  ];

  return (
    <>
      <PageHeader title={t("acct.intelligence")} description={t("acct.intel.sub", { name: current.name, cur })}
        actions={<CompanyPicker companies={companies} current={current.id} />} />

      <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Metric label={t("acct.intel.revenueYtd")} value={`${num(overview.revenue)}`} category="info" />
        <Metric label={t("acct.intel.grossProfit")} value={`${num(overview.grossProfit)}`} category="success" />
        <Metric label={t("acct.intel.netProfit")} value={`${num(overview.netProfit)}`} category={Number(overview.netProfit) >= 0 ? "success" : "critical"} />
        <Metric label={t("acct.intel.cashBank")} value={`${num(overview.cash)}`} />
        <Metric label={t("acct.intel.arOutstanding")} value={`${num(overview.arOutstanding)}`} category="warning" />
        <Metric label={t("acct.intel.apOutstanding")} value={`${num(overview.apOutstanding)}`} category="warning" />
        <Metric label={t("acct.intel.operatingProfit")} value={`${num(overview.operatingProfit)}`} />
        <Metric label={t("acct.intel.period")} value={`${overview.period.from.toISOString().slice(5, 10)} → ${overview.period.to.toISOString().slice(5, 10)}`} />
      </div>

      <div className="mb-3 flex flex-wrap gap-1 border-b border-line">
        {DIMS.map((d) => (
          <Link key={d.key} href={`/accounting/intelligence?company=${current.id}&dim=${d.key}`}
            className={`-mb-px border-b-2 px-3 py-2 text-[13px] ${dim === d.key ? "border-accent font-medium text-ink" : "border-transparent text-ink-3 hover:text-ink-2"}`}>{t(d.labelKey)}</Link>
        ))}
      </div>

      <Panel>
        <PanelHeader title={t("acct.intel.plBy", { dim: dimLabel(dim) })} icon={<BarChart4 className="h-4 w-4" />} action={<Badge category="info">{pnl.rows.length}</Badge>} />
        <DataTable columns={columns} rows={pnl.rows} getRowKey={(r) => r.id}
          empty={<EmptyState title={t("acct.intel.noActivity")} description={t("acct.intel.noActivityBody", { dim: dimLabel(dim) })} />} />
        <div className="flex flex-wrap justify-end gap-8 border-t border-line px-4 py-2 text-[13px] font-medium">
          <span>{t("acct.intel.revenue")} <span className="ms-1 tabular text-ink">{num(pnl.totals.revenue)}</span></span>
          <span>{t("acct.intel.gross")} <span className="ms-1 tabular text-ink">{num(pnl.totals.grossProfit)}</span></span>
          <span>{t("acct.intel.net")} <span className="ms-1 tabular text-ink">{num(pnl.totals.netProfit)} {cur}</span></span>
        </div>
      </Panel>
    </>
  );
}
