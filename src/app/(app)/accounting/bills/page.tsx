import type { Metadata } from "next";
import { ReceiptText, Plus } from "lucide-react";
import Link from "next/link";
import { pageGuard } from "@/lib/page-guard";
import { AccessDenied } from "@/components/access-denied";
import { canAnywhere } from "@/lib/permissions/engine";
import { resolveAccountingCompany } from "@/domain/accounting/access";
import { listBills } from "@/domain/accounting/ap";
import { PageHeader, Panel, DataTable, Badge, EmptyState, Button, type Column } from "@/components/ui";
import { CompanyPicker } from "@/components/accounting/company-picker";
import { ExportButton } from "@/components/list/export-button";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Supplier Bills" };

const STATUS_CAT: Record<string, "neutral" | "info" | "success" | "warning" | "critical"> = { draft: "neutral", open: "info", partially_paid: "warning", paid: "success", void: "critical" };

export default async function BillsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const { principal, locale, denied } = await pageGuard("ap.view");
  if (denied) return <AccessDenied locale={locale} />;
  const sp = await searchParams;
  const { companies, current } = await resolveAccountingCompany(principal, sp.company);
  if (!current) return <><PageHeader title="Supplier Bills" /><Panel><EmptyState title="No company in scope" /></Panel></>;

  const { rows } = await listBills(principal, current.id, { q: sp.q, status: sp.status, supplierId: sp.supplierId, pageSize: 200 }).catch(() => ({ rows: [] as never[] }));
  const canCreate = canAnywhere(principal, "ap.create");
  const num = (v: unknown) => Number(v).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 3 });
  type Row = (typeof rows)[number];

  const columns: Column<Row>[] = [
    { key: "number", header: "Number", render: (b) => <Link href={`/accounting/bills/${b.id}`} className="font-mono text-ink hover:text-accent">{b.billNumber ?? "draft"}</Link> },
    { key: "supplier", header: "Supplier", render: (b) => <span className="text-ink-2">{b.supplier.name}</span> },
    { key: "ref", header: "Supplier ref", render: (b) => <span className="text-ink-3">{b.supplierRef ?? "—"}</span> },
    { key: "issue", header: "Date", render: (b) => <span className="text-ink-3">{formatDate(b.issueDate, locale)}</span> },
    { key: "due", header: "Due", render: (b) => <span className="text-ink-3">{b.dueDate ? formatDate(b.dueDate, locale) : "—"}</span> },
    { key: "total", header: "Total", align: "end", render: (b) => <span className="tabular text-ink-2">{num(b.total)} {b.currency}</span> },
    { key: "balance", header: "Balance due", align: "end", render: (b) => <span className="tabular text-ink">{num(b.amountDue)}</span> },
    { key: "status", header: "Status", align: "center", render: (b) => <Badge category={STATUS_CAT[b.status] ?? "neutral"}>{b.status.replace("_", " ")}</Badge> },
  ];

  return (
    <>
      <PageHeader title="Supplier Bills" description={`Accounts payable for ${current.name} (${current.baseCurrency}).`}
        actions={<div className="flex items-center gap-2"><CompanyPicker companies={companies} current={current.id} /><ExportButton resource="bills" />{canCreate && <Link href={`/accounting/bills/new?company=${current.id}`}><Button variant="primary" size="sm"><Plus className="h-4 w-4" /> New bill</Button></Link>}</div>} />
      <Panel>
        <DataTable columns={columns} rows={rows} getRowKey={(b) => b.id}
          empty={<EmptyState icon={<ReceiptText className="h-5 w-5" />} title="No bills" description="Record a supplier bill to post an expense and payable." />} />
      </Panel>
    </>
  );
}
