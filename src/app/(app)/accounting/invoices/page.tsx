import type { Metadata } from "next";
import { FileText, Plus } from "lucide-react";
import Link from "next/link";
import { pageGuard } from "@/lib/page-guard";
import { getServerI18n } from "@/lib/server-i18n";
import { AccessDenied } from "@/components/access-denied";
import { canAnywhere } from "@/lib/permissions/engine";
import { resolveAccountingCompany } from "@/domain/accounting/access";
import { listInvoices } from "@/domain/accounting/ar";
import { PageHeader, Panel, DataTable, Badge, EmptyState, Button, type Column } from "@/components/ui";
import { CompanyPicker } from "@/components/accounting/company-picker";
import { ExportButton } from "@/components/list/export-button";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Sales Invoices" };

const STATUS_CAT: Record<string, "neutral" | "info" | "success" | "warning" | "critical"> = { draft: "neutral", issued: "info", partially_paid: "warning", paid: "success", void: "critical", written_off: "critical" };

export default async function InvoicesPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const { principal, locale, denied } = await pageGuard("ar.view");
  if (denied) return <AccessDenied locale={locale} />;
  const { t } = await getServerI18n();
  const sp = await searchParams;
  const { companies, current } = await resolveAccountingCompany(principal, sp.company);
  if (!current) return <><PageHeader title={t("acct.invoices")} /><Panel><EmptyState title={t("acct.noCompany")} /></Panel></>;

  const { rows } = await listInvoices(principal, current.id, { q: sp.q, status: sp.status, customerId: sp.customerId, pageSize: 200 }).catch(() => ({ rows: [] as never[] }));
  const canCreate = canAnywhere(principal, "ar.create");
  const cur = current.baseCurrency;
  type Row = (typeof rows)[number];

  const num = (v: unknown) => Number(v).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 3 });
  const columns: Column<Row>[] = [
    { key: "number", header: t("acct.col.number"), render: (i) => <Link href={`/accounting/invoices/${i.id}`} className="font-mono text-ink hover:text-accent">{i.invoiceNumber ?? "draft"}</Link> },
    { key: "customer", header: t("acct.col.customer"), render: (i) => <span className="text-ink-2">{i.customer.name}</span> },
    { key: "issue", header: t("common.date"), render: (i) => <span className="text-ink-3">{formatDate(i.issueDate, locale)}</span> },
    { key: "due", header: t("common.due"), render: (i) => <span className="text-ink-3">{i.dueDate ? formatDate(i.dueDate, locale) : "—"}</span> },
    { key: "total", header: t("common.total"), align: "end", render: (i) => <span className="tabular text-ink-2">{num(i.total)} {i.currency}</span> },
    { key: "balance", header: t("acct.col.balanceDue"), align: "end", render: (i) => <span className="tabular text-ink">{num(i.amountDue)}</span> },
    { key: "status", header: t("common.status"), align: "center", render: (i) => <Badge category={STATUS_CAT[i.status] ?? "neutral"}>{i.status.replace("_", " ")}</Badge> },
  ];

  return (
    <>
      <PageHeader title={t("acct.invoices")} description={`Accounts receivable for ${current.name} (${cur}).`}
        actions={<div className="flex items-center gap-2"><CompanyPicker companies={companies} current={current.id} /><ExportButton resource="invoices" />{canCreate && <Link href={`/accounting/invoices/new?company=${current.id}`}><Button variant="primary" size="sm"><Plus className="h-4 w-4" /> New invoice</Button></Link>}</div>} />
      <Panel>
        <DataTable columns={columns} rows={rows} getRowKey={(i) => i.id}
          empty={<EmptyState icon={<FileText className="h-5 w-5" />} title="No invoices" description="Create a sales invoice to post revenue and receivables." />} />
      </Panel>
    </>
  );
}
