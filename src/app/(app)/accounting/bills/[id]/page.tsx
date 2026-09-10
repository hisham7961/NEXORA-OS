import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { pageGuard } from "@/lib/page-guard";
import { getServerI18n } from "@/lib/server-i18n";
import { AccessDenied } from "@/components/access-denied";
import { canAnywhere, ForbiddenError } from "@/lib/permissions/engine";
import { getBill } from "@/domain/accounting/ap";
import { PageHeader, Panel, PanelHeader, DataTable, Badge, type Column } from "@/components/ui";
import { PostBillButton, VoidBillButton } from "@/components/accounting/ap-controls";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Bill" };

const STATUS_CAT: Record<string, "neutral" | "info" | "success" | "warning" | "critical"> = { draft: "neutral", open: "info", partially_paid: "warning", paid: "success", void: "critical" };

export default async function BillDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { principal, locale, denied } = await pageGuard("ap.view");
  if (denied) return <AccessDenied locale={locale} />;
  const { t } = await getServerI18n();
  const { id } = await params;
  let bill;
  try { bill = await getBill(principal, id); } catch (e) { if (e instanceof ForbiddenError) return <AccessDenied locale={locale} />; throw e; }
  if (!bill) notFound();

  const num = (v: unknown) => Number(v).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 3 });
  const canCreate = canAnywhere(principal, "ap.create");
  const canManage = canAnywhere(principal, "ap.manage");

  type L = (typeof bill.lines)[number];
  const columns: Column<L>[] = [
    { key: "desc", header: t("common.description"), render: (l) => <span className="text-ink">{l.description}</span> },
    { key: "qty", header: t("acct.col.qty"), align: "end", render: (l) => <span className="tabular text-ink-3">{num(l.quantity)}</span> },
    { key: "price", header: t("acct.col.unitPrice"), align: "end", render: (l) => <span className="tabular text-ink-3">{num(l.unitPrice)}</span> },
    { key: "tax", header: t("acct.col.tax"), align: "end", render: (l) => <span className="tabular text-ink-3">{Number(l.taxAmount) ? num(l.taxAmount) : "—"}</span> },
    { key: "net", header: t("acct.col.lineTotal"), align: "end", render: (l) => <span className="tabular text-ink">{num(l.lineNet)}</span> },
  ];

  return (
    <>
      <div className="mb-1 text-xs text-ink-3"><Link href={`/accounting/bills?company=${bill.companyId}`} className="hover:text-ink-2">{t("acct.supplierBills")}</Link> / {bill.billNumber ?? t("fin.draft")}</div>
      <PageHeader title={bill.billNumber ?? t("acct.draftBill")} description={bill.supplier.name}
        meta={<div className="flex items-center gap-2"><Badge category={STATUS_CAT[bill.status] ?? "neutral"}>{t(`status.${bill.status}`)}</Badge><span className="text-xs text-ink-3">{formatDate(bill.issueDate, locale)}</span></div>}
        actions={<div className="flex items-center gap-2">
          {bill.status === "draft" && canCreate && <PostBillButton id={bill.id} kind="bill" />}
          {(bill.status === "open" || bill.status === "draft") && canManage && <VoidBillButton id={bill.id} />}
          {bill.journalEntryId && <Link href={`/accounting/journal/${bill.journalEntryId}`} className="text-[12px] text-accent hover:underline">{t("fin.viewGlEntry")}</Link>}
        </div>} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_300px]">
        <Panel>
          <PanelHeader title={t("acct.lines")} />
          <DataTable columns={columns} rows={bill.lines} getRowKey={(l) => l.id} />
          <div className="space-y-1 border-t border-line px-4 py-3 text-[13px]">
            <div className="flex justify-end gap-8"><span className="text-ink-3">{t("fin.subtotal")}</span><span className="tabular text-ink-2">{num(bill.subtotal)} {bill.currency}</span></div>
            <div className="flex justify-end gap-8"><span className="text-ink-3">{t("fin.tax")}</span><span className="tabular text-ink-2">{num(bill.taxTotal)}</span></div>
            <div className="flex justify-end gap-8 font-semibold"><span>{t("common.total")}</span><span className="tabular text-ink">{num(bill.total)}</span></div>
            <div className="flex justify-end gap-8"><span className="text-ink-3">{t("fin.paid")}</span><span className="tabular text-ink-2">{num(bill.amountPaid)}</span></div>
            <div className="flex justify-end gap-8 font-semibold"><span>{t("fin.balanceDue")}</span><span className="tabular text-ink">{num(bill.amountDue)}</span></div>
          </div>
        </Panel>
        <div className="space-y-4">
          <Panel>
            <PanelHeader title={t("acct.details")} />
            <dl className="space-y-2 px-4 py-3 text-[13px]">
              <div className="flex justify-between"><dt className="text-ink-3">{t("fin.supplier")}</dt><dd className="text-ink">{bill.supplier.name}</dd></div>
              {bill.supplierRef && <div className="flex justify-between"><dt className="text-ink-3">{t("fin.supplierRef")}</dt><dd className="text-ink">{bill.supplierRef}</dd></div>}
              <div className="flex justify-between"><dt className="text-ink-3">{t("fin.issueDate")}</dt><dd className="text-ink">{formatDate(bill.issueDate, locale)}</dd></div>
              <div className="flex justify-between"><dt className="text-ink-3">{t("fin.dueDate")}</dt><dd className="text-ink">{bill.dueDate ? formatDate(bill.dueDate, locale) : "—"}</dd></div>
              <div className="flex justify-between"><dt className="text-ink-3">{t("common.currency")}</dt><dd className="text-ink">{bill.currency}</dd></div>
            </dl>
          </Panel>
          {(bill.allocations.length > 0 || bill.creditApplications.length > 0) && (
            <Panel>
              <PanelHeader title={t("acct.paymentsCredits")} />
              <div className="space-y-1.5 px-4 py-3 text-[13px]">
                {bill.allocations.map((a) => <div key={a.id} className="flex justify-between"><span className="text-ink-2">{t("acct.paymentN", { number: a.payment.paymentNumber ?? "" })}</span><span className="tabular text-ink">{num(a.amount)}</span></div>)}
                {bill.creditApplications.map((a) => <div key={a.id} className="flex justify-between"><span className="text-ink-2">{t("acct.creditN", { number: a.credit.creditNumber ?? "" })}</span><span className="tabular text-ink">{num(a.amount)}</span></div>)}
              </div>
            </Panel>
          )}
        </div>
      </div>
    </>
  );
}
