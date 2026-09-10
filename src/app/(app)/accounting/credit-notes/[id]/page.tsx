import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { pageGuard } from "@/lib/page-guard";
import { getServerI18n } from "@/lib/server-i18n";
import { AccessDenied } from "@/components/access-denied";
import { canAnywhere, ForbiddenError } from "@/lib/permissions/engine";
import { getCreditNote, listInvoices } from "@/domain/accounting/ar";
import { PageHeader, Panel, PanelHeader, DataTable, Badge, type Column } from "@/components/ui";
import { IssueButton, ApplyCreditNoteButton } from "@/components/accounting/ar-controls";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Credit Note" };

const STATUS_CAT: Record<string, "neutral" | "info" | "success" | "warning" | "critical"> = { draft: "neutral", issued: "info", applied: "success", void: "critical" };

export default async function CreditNoteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { principal, locale, denied } = await pageGuard("ar.view");
  if (denied) return <AccessDenied locale={locale} />;
  const { t } = await getServerI18n();
  const { id } = await params;
  let cn;
  try { cn = await getCreditNote(principal, id); } catch (e) { if (e instanceof ForbiddenError) return <AccessDenied locale={locale} />; throw e; }
  if (!cn) notFound();

  const num = (v: unknown) => Number(v).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 3 });
  const canCreate = canAnywhere(principal, "ar.create");
  const remaining = Number(cn.amountRemaining);

  const openInvoices = remaining > 0
    ? (await listInvoices(principal, cn.companyId, { customerId: cn.customerId, pageSize: 200 })).rows.filter((i) => ["issued", "partially_paid"].includes(i.status)).map((i) => ({ id: i.id, invoiceNumber: i.invoiceNumber, amountDue: Number(i.amountDue) }))
    : [];

  type L = (typeof cn.lines)[number];
  const columns: Column<L>[] = [
    { key: "desc", header: t("common.description"), render: (l) => <span className="text-ink">{l.description}</span> },
    { key: "qty", header: t("acct.col.qty"), align: "end", render: (l) => <span className="tabular text-ink-3">{num(l.quantity)}</span> },
    { key: "price", header: t("acct.col.unitPrice"), align: "end", render: (l) => <span className="tabular text-ink-3">{num(l.unitPrice)}</span> },
    { key: "tax", header: t("acct.col.tax"), align: "end", render: (l) => <span className="tabular text-ink-3">{Number(l.taxAmount) ? num(l.taxAmount) : "—"}</span> },
    { key: "net", header: t("acct.col.lineTotal"), align: "end", render: (l) => <span className="tabular text-ink">{num(l.lineNet)}</span> },
  ];

  return (
    <>
      <div className="mb-1 text-xs text-ink-3"><Link href={`/accounting/credit-notes?company=${cn.companyId}`} className="hover:text-ink-2">{t("acct.creditNotes")}</Link> / {cn.creditNoteNumber ?? t("fin.draft")}</div>
      <PageHeader title={cn.creditNoteNumber ?? t("acct.draftCreditNote")} description={cn.customer.name}
        meta={<div className="flex items-center gap-2"><Badge category={STATUS_CAT[cn.status] ?? "neutral"}>{t(`status.${cn.status}`)}</Badge><span className="text-xs text-ink-3">{formatDate(cn.issueDate, locale)}</span></div>}
        actions={<div className="flex items-center gap-2">
          {cn.status === "draft" && canCreate && <IssueButton id={cn.id} kind="credit_note" />}
          {(cn.status === "issued") && canCreate && remaining > 0 && <ApplyCreditNoteButton creditNoteId={cn.id} remaining={remaining} currency={cn.currency} openInvoices={openInvoices} />}
          {cn.journalEntryId && <Link href={`/accounting/journal/${cn.journalEntryId}`} className="text-[12px] text-accent hover:underline">{t("fin.viewGlEntry")}</Link>}
        </div>} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_300px]">
        <Panel>
          <PanelHeader title={t("acct.lines")} />
          <DataTable columns={columns} rows={cn.lines} getRowKey={(l) => l.id} />
          <div className="space-y-1 border-t border-line px-4 py-3 text-[13px]">
            <div className="flex justify-end gap-8"><span className="text-ink-3">{t("fin.subtotal")}</span><span className="tabular text-ink-2">{num(cn.subtotal)} {cn.currency}</span></div>
            <div className="flex justify-end gap-8"><span className="text-ink-3">{t("fin.tax")}</span><span className="tabular text-ink-2">{num(cn.taxTotal)}</span></div>
            <div className="flex justify-end gap-8 font-semibold"><span>{t("common.total")}</span><span className="tabular text-ink">{num(cn.total)}</span></div>
            <div className="flex justify-end gap-8"><span className="text-ink-3">{t("acct.applied")}</span><span className="tabular text-ink-2">{num(cn.amountApplied)}</span></div>
            <div className="flex justify-end gap-8 font-semibold"><span>{t("acct.unapplied")}</span><span className="tabular text-ink">{num(cn.amountRemaining)}</span></div>
          </div>
        </Panel>
        <div className="space-y-4">
          <Panel>
            <PanelHeader title={t("acct.details")} />
            <dl className="space-y-2 px-4 py-3 text-[13px]">
              <div className="flex justify-between"><dt className="text-ink-3">{t("fin.customer")}</dt><dd className="text-ink">{cn.customer.name}</dd></div>
              {cn.reason && <div className="flex justify-between"><dt className="text-ink-3">{t("fin.reason")}</dt><dd className="text-ink">{cn.reason}</dd></div>}
              <div className="flex justify-between"><dt className="text-ink-3">{t("common.currency")}</dt><dd className="text-ink">{cn.currency}</dd></div>
            </dl>
          </Panel>
          {cn.applications.length > 0 && (
            <Panel>
              <PanelHeader title={t("acct.appliedTo")} />
              <div className="space-y-1.5 px-4 py-3 text-[13px]">
                {cn.applications.map((a) => <div key={a.id} className="flex justify-between"><span className="text-ink-2">{a.invoice.invoiceNumber}</span><span className="tabular text-ink">{num(a.amount)}</span></div>)}
              </div>
            </Panel>
          )}
        </div>
      </div>
    </>
  );
}
