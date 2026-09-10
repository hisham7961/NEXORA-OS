import type { Metadata } from "next";
import { FileMinus, Plus } from "lucide-react";
import Link from "next/link";
import { pageGuard } from "@/lib/page-guard";
import { getServerI18n } from "@/lib/server-i18n";
import { AccessDenied } from "@/components/access-denied";
import { canAnywhere } from "@/lib/permissions/engine";
import { resolveAccountingCompany } from "@/domain/accounting/access";
import { listSupplierCredits } from "@/domain/accounting/ap";
import { PageHeader, Panel, DataTable, Badge, EmptyState, Button, type Column } from "@/components/ui";
import { CompanyPicker } from "@/components/accounting/company-picker";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Supplier Credits" };

const STATUS_CAT: Record<string, "neutral" | "info" | "success" | "warning" | "critical"> = { draft: "neutral", open: "info", applied: "success", void: "critical" };

export default async function SupplierCreditsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const { principal, locale, denied } = await pageGuard("ap.view");
  if (denied) return <AccessDenied locale={locale} />;
  const { t } = await getServerI18n();
  const sp = await searchParams;
  const { companies, current } = await resolveAccountingCompany(principal, sp.company);
  if (!current) return <><PageHeader title={t("acct.supplierCredits")} /><Panel><EmptyState title={t("acct.noCompany")} /></Panel></>;

  const { rows } = await listSupplierCredits(principal, current.id, { pageSize: 200 }).catch(() => ({ rows: [] as never[] }));
  const canCreate = canAnywhere(principal, "ap.create");
  const num = (v: unknown) => Number(v).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 3 });
  type Row = (typeof rows)[number];

  const columns: Column<Row>[] = [
    { key: "number", header: t("acct.col.number"), render: (c) => <Link href={`/accounting/supplier-credits/${c.id}`} className="font-mono text-ink hover:text-accent">{c.creditNumber ?? t("fin.draft")}</Link> },
    { key: "supplier", header: t("acct.col.supplier"), render: (c) => <span className="text-ink-2">{c.supplier.name}</span> },
    { key: "date", header: t("common.date"), render: (c) => <span className="text-ink-3">{formatDate(c.issueDate, locale)}</span> },
    { key: "total", header: t("common.total"), align: "end", render: (c) => <span className="tabular text-ink-2">{num(c.total)} {c.currency}</span> },
    { key: "remaining", header: t("acct.col.unapplied"), align: "end", render: (c) => <span className="tabular text-ink">{num(c.amountRemaining)}</span> },
    { key: "status", header: t("common.status"), align: "center", render: (c) => <Badge category={STATUS_CAT[c.status] ?? "neutral"}>{t(`status.${c.status}`)}</Badge> },
  ];

  return (
    <>
      <PageHeader title={t("acct.supplierCredits")} description={t("acct.supplierCreditsSub", { name: current.name, cur: current.baseCurrency })}
        actions={<div className="flex items-center gap-2"><CompanyPicker companies={companies} current={current.id} />{canCreate && <Link href={`/accounting/supplier-credits/new?company=${current.id}`}><Button variant="primary" size="sm"><Plus className="h-4 w-4" /> {t("fin.newCreditBtn")}</Button></Link>}</div>} />
      <Panel>
        <DataTable columns={columns} rows={rows} getRowKey={(c) => c.id}
          empty={<EmptyState icon={<FileMinus className="h-5 w-5" />} title={t("acct.noSupplierCredits")} description={t("acct.noSupplierCreditsBody")} />} />
      </Panel>
    </>
  );
}
