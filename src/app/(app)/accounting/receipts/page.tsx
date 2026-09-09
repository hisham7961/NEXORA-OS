import type { Metadata } from "next";
import { HandCoins } from "lucide-react";
import Link from "next/link";
import { pageGuard } from "@/lib/page-guard";
import { AccessDenied } from "@/components/access-denied";
import { canAnywhere } from "@/lib/permissions/engine";
import { resolveAccountingCompany } from "@/domain/accounting/access";
import { listReceipts, listInvoices } from "@/domain/accounting/ar";
import { listCustomers } from "@/domain/accounting/customers";
import { PageHeader, Panel, DataTable, Badge, EmptyState, type Column } from "@/components/ui";
import { CompanyPicker } from "@/components/accounting/company-picker";
import { RecordReceiptButton } from "@/components/accounting/ar-controls";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Receipts" };

export default async function ReceiptsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const { principal, locale, denied } = await pageGuard("payments.view");
  if (denied) return <AccessDenied locale={locale} />;
  const sp = await searchParams;
  const { companies, current } = await resolveAccountingCompany(principal, sp.company);
  if (!current) return <><PageHeader title="Receipts" /><Panel><EmptyState title="No company in scope" /></Panel></>;

  const canCreate = canAnywhere(principal, "payments.create");
  const [{ rows }, customersRes, openInvoicesRes] = await Promise.all([
    listReceipts(principal, current.id, { pageSize: 200 }).catch(() => ({ rows: [] as never[] })),
    canCreate ? listCustomers(principal, current.id, { active: "active", pageSize: 500 }) : Promise.resolve({ rows: [] as { id: string; name: string }[] }),
    canCreate ? listInvoices(principal, current.id, { pageSize: 500 }) : Promise.resolve({ rows: [] as { id: string; invoiceNumber: string | null; customerId: string; amountDue: unknown; status: string }[] }),
  ]);
  const openInvoices = openInvoicesRes.rows.filter((i) => ["issued", "partially_paid"].includes(i.status)).map((i) => ({ id: i.id, invoiceNumber: i.invoiceNumber, customerId: i.customerId, amountDue: Number(i.amountDue) }));

  const num = (v: unknown) => Number(v).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 3 });
  type Row = (typeof rows)[number];
  const columns: Column<Row>[] = [
    { key: "number", header: "Number", render: (r) => <span className="font-mono text-ink">{r.receiptNumber}</span> },
    { key: "customer", header: "Customer", render: (r) => <span className="text-ink-2">{r.customer.name}</span> },
    { key: "date", header: "Date", render: (r) => <span className="text-ink-3">{formatDate(r.receiptDate, locale)}</span> },
    { key: "method", header: "Method", align: "center", render: (r) => <span className="text-ink-3 capitalize">{r.method ?? "—"}</span> },
    { key: "amount", header: "Amount", align: "end", render: (r) => <span className="tabular text-ink-2">{num(r.amount)} {r.currency}</span> },
    { key: "unapplied", header: "Unapplied", align: "end", render: (r) => <span className="tabular text-ink">{Number(r.unappliedAmount) ? num(r.unappliedAmount) : "—"}</span> },
    { key: "gl", header: "", align: "end", render: (r) => r.journalEntryId ? <Link href={`/accounting/journal/${r.journalEntryId}`} className="text-[12px] text-accent hover:underline">GL →</Link> : null },
  ];

  return (
    <>
      <PageHeader title="Receipts" description={`Customer payments received for ${current.name} (${current.baseCurrency}).`}
        actions={<div className="flex items-center gap-2"><CompanyPicker companies={companies} current={current.id} />{canCreate && <RecordReceiptButton companyId={current.id} baseCurrency={current.baseCurrency} customers={customersRes.rows.map((c) => ({ id: c.id, name: c.name }))} openInvoices={openInvoices} />}</div>} />
      <Panel>
        <DataTable columns={columns} rows={rows} getRowKey={(r) => r.id}
          empty={<EmptyState icon={<HandCoins className="h-5 w-5" />} title="No receipts" description="Record a customer payment to settle open invoices." />} />
      </Panel>
    </>
  );
}
