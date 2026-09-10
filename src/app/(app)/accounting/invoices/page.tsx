import type { Metadata } from "next";
import { FileText, Plus } from "lucide-react";
import Link from "next/link";
import { pageGuard } from "@/lib/page-guard";
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
  const sp = await searchParams;
  const { companies, current } = await resolveAccountingCompany(principal, sp.company);
  if (!current) return <><PageHeader title="Sales Invoices" /><Panel><EmptyState title="No company in scope" /></Panel></>;

  const { rows } = await listInvoices(principal, current.id, { q: sp.q, status: sp.status, customerId: sp.customerId, pageSize: 200 }).catch(() => ({ rows: [] as never[] }));
  const canCreate = canAnywhere(principal, "ar.create");
  const cur = current.baseCurrency;
  type Row = (typeof rows)[number];

  const num = (v: unknown) => Number(v).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 3 });
  const columns: Column<Row>[] = [
    { key: "number", header: "Number", render: (i) => <Link href={`/accounting/invoices/${i.id}`} className="font-mono text-ink hover:text-accent">{i.invoiceNumber ?? "draft"}</Link> },
    { key: "customer", header: "Customer", render: (i) => <span className="text-ink-2">{i.customer.name}</span> },
    { key: "issue", header: "Date", render: (i) => <span className="text-ink-3">{formatDate(i.issueDate, locale)}</span> },
    { key: "due", header: "Due", render: (i) => <span className="text-ink-3">{i.dueDate ? formatDate(i.dueDate, locale) : "—"}</span> },
    { key: "total", header: "Total", align: "end", render: (i) => <span className="tabular text-ink-2">{num(i.total)} {i.currency}</span> },
    { key: "balance", header: "Balance due", align: "end", render: (i) => <span className="tabular text-ink">{num(i.amountDue)}</span> },
    { key: "status", header: "Status", align: "center", render: (i) => <Badge category={STATUS_CAT[i.status] ?? "neutral"}>{i.status.replace("_", " ")}</Badge> },
  ];

  return (
    <>
      <PageHeader title="Sales Invoices" description={`Accounts receivable for ${current.name} (${cur}).`}
        actions={<div className="flex items-center gap-2"><CompanyPicker companies={companies} current={current.id} /><ExportButton resource="invoices" />{canCreate && <Link href={`/accounting/invoices/new?company=${current.id}`}><Button variant="primary" size="sm"><Plus className="h-4 w-4" /> New invoice</Button></Link>}</div>} />
      <Panel>
        <DataTable columns={columns} rows={rows} getRowKey={(i) => i.id}
          empty={<EmptyState icon={<FileText className="h-5 w-5" />} title="No invoices" description="Create a sales invoice to post revenue and receivables." />} />
      </Panel>
    </>
  );
}
