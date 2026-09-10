import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { pageGuard } from "@/lib/page-guard";
import { getServerI18n } from "@/lib/server-i18n";
import { AccessDenied } from "@/components/access-denied";
import { canAnywhere, ForbiddenError } from "@/lib/permissions/engine";
import { getInvoice } from "@/domain/accounting/ar";
import { PageHeader, Panel, PanelHeader, DataTable, Badge, type Column } from "@/components/ui";
import { IssueButton, VoidInvoiceButton } from "@/components/accounting/ar-controls";
import { RecordComments } from "@/components/comments/record-comments";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Invoice" };

const STATUS_CAT: Record<string, "neutral" | "info" | "success" | "warning" | "critical"> = { draft: "neutral", issued: "info", partially_paid: "warning", paid: "success", void: "critical", written_off: "critical" };

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { principal, locale, denied } = await pageGuard("ar.view");
  if (denied) return <AccessDenied locale={locale} />;
  const { t } = await getServerI18n();
  const { id } = await params;
  let inv;
  try { inv = await getInvoice(principal, id); } catch (e) { if (e instanceof ForbiddenError) return <AccessDenied locale={locale} />; throw e; }
  if (!inv) notFound();

  const num = (v: unknown) => Number(v).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 3 });
  const canCreate = canAnywhere(principal, "ar.create");
  const canManage = canAnywhere(principal, "ar.manage");

  type L = (typeof inv.lines)[number];
  const columns: Column<L>[] = [
    { key: "desc", header: t("common.description"), render: (l) => <span className="text-ink">{l.description}</span> },
    { key: "qty", header: t("acct.col.qty"), align: "end", render: (l) => <span className="tabular text-ink-3">{num(l.quantity)}</span> },
    { key: "price", header: t("acct.col.unitPrice"), align: "end", render: (l) => <span className="tabular text-ink-3">{num(l.unitPrice)}</span> },
    { key: "disc", header: "Disc %", align: "end", render: (l) => <span className="tabular text-ink-3">{Number(l.discountPct) ? num(l.discountPct) : "—"}</span> },
    { key: "tax", header: t("acct.col.tax"), align: "end", render: (l) => <span className="tabular text-ink-3">{Number(l.taxAmount) ? num(l.taxAmount) : "—"}</span> },
    { key: "net", header: t("acct.col.lineTotal"), align: "end", render: (l) => <span className="tabular text-ink">{num(l.lineNet)}</span> },
  ];

  const actions = (
    <div className="flex items-center gap-2">
      {inv.status === "draft" && canCreate && <IssueButton id={inv.id} kind="invoice" />}
      {(inv.status === "issued" || inv.status === "draft") && canManage && <VoidInvoiceButton id={inv.id} />}
      {inv.journalEntryId && <Link href={`/accounting/journal/${inv.journalEntryId}`} className="text-[12px] text-accent hover:underline">View GL entry →</Link>}
    </div>
  );

  return (
    <>
      <div className="mb-1 text-xs text-ink-3"><Link href={`/accounting/invoices?company=${inv.companyId}`} className="hover:text-ink-2">Sales Invoices</Link> / {inv.invoiceNumber ?? "draft"}</div>
      <PageHeader title={inv.invoiceNumber ?? "Draft invoice"} description={inv.customer.name}
        meta={<div className="flex items-center gap-2"><Badge category={STATUS_CAT[inv.status] ?? "neutral"}>{inv.status.replace("_", " ")}</Badge><span className="text-xs text-ink-3">{formatDate(inv.issueDate, locale)}</span></div>}
        actions={actions} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_300px]">
        <Panel>
          <PanelHeader title={t("acct.lines")} />
          <DataTable columns={columns} rows={inv.lines} getRowKey={(l) => l.id} />
          <div className="space-y-1 border-t border-line px-4 py-3 text-[13px]">
            <div className="flex justify-end gap-8"><span className="text-ink-3">Subtotal</span><span className="tabular text-ink-2">{num(inv.subtotal)} {inv.currency}</span></div>
            <div className="flex justify-end gap-8"><span className="text-ink-3">Tax</span><span className="tabular text-ink-2">{num(inv.taxTotal)}</span></div>
            <div className="flex justify-end gap-8 font-semibold"><span>Total</span><span className="tabular text-ink">{num(inv.total)}</span></div>
            <div className="flex justify-end gap-8"><span className="text-ink-3">Paid</span><span className="tabular text-ink-2">{num(inv.amountPaid)}</span></div>
            <div className="flex justify-end gap-8 font-semibold"><span>Balance due</span><span className="tabular text-ink">{num(inv.amountDue)}</span></div>
          </div>
        </Panel>
        <div className="space-y-4">
          <Panel>
            <PanelHeader title={t("acct.details")} />
            <dl className="space-y-2 px-4 py-3 text-[13px]">
              <Row label="Customer" value={inv.customer.name} />
              <Row label="Issue date" value={formatDate(inv.issueDate, locale)} />
              <Row label="Due date" value={inv.dueDate ? formatDate(inv.dueDate, locale) : "—"} />
              <Row label="Currency" value={inv.currency + (inv.currency !== inv.baseCurrency && inv.exchangeRate ? ` @ ${inv.exchangeRate}` : "")} />
              {inv.reference && <Row label="Reference" value={inv.reference} />}
            </dl>
          </Panel>
          {(inv.allocations.length > 0 || inv.creditApplications.length > 0) && (
            <Panel>
              <PanelHeader title={t("acct.paymentsCredits")} />
              <div className="space-y-1.5 px-4 py-3 text-[13px]">
                {inv.allocations.map((a) => <div key={a.id} className="flex justify-between"><span className="text-ink-2">Receipt {a.receipt.receiptNumber}</span><span className="tabular text-ink">{num(a.amount)}</span></div>)}
                {inv.creditApplications.map((a) => <div key={a.id} className="flex justify-between"><span className="text-ink-2">Credit {a.creditNote.creditNoteNumber}</span><span className="tabular text-ink">{num(a.amount)}</span></div>)}
              </div>
            </Panel>
          )}
        </div>
      </div>

      <Panel className="mt-4">
        <PanelHeader title="Comments" />
        <div className="px-4 py-3"><RecordComments entityType="invoice" entityId={inv.id} currentUserId={principal.userId} /></div>
      </Panel>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between"><dt className="text-ink-3">{label}</dt><dd className="text-ink">{value}</dd></div>;
}
