import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { pageGuard } from "@/lib/page-guard";
import { getServerI18n } from "@/lib/server-i18n";
import { AccessDenied } from "@/components/access-denied";
import { canAnywhere, ForbiddenError } from "@/lib/permissions/engine";
import { getSupplierCredit, listBills } from "@/domain/accounting/ap";
import { PageHeader, Panel, PanelHeader, DataTable, Badge, type Column } from "@/components/ui";
import { PostBillButton, ApplySupplierCreditButton } from "@/components/accounting/ap-controls";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Supplier Credit" };

const STATUS_CAT: Record<string, "neutral" | "info" | "success" | "warning" | "critical"> = { draft: "neutral", open: "info", applied: "success", void: "critical" };

export default async function SupplierCreditDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { principal, locale, denied } = await pageGuard("ap.view");
  if (denied) return <AccessDenied locale={locale} />;
  const { t } = await getServerI18n();
  const { id } = await params;
  let cr;
  try { cr = await getSupplierCredit(principal, id); } catch (e) { if (e instanceof ForbiddenError) return <AccessDenied locale={locale} />; throw e; }
  if (!cr) notFound();

  const num = (v: unknown) => Number(v).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 3 });
  const canCreate = canAnywhere(principal, "ap.create");
  const remaining = Number(cr.amountRemaining);
  const openBills = remaining > 0
    ? (await listBills(principal, cr.companyId, { supplierId: cr.supplierId, pageSize: 200 })).rows.filter((b) => ["open", "partially_paid"].includes(b.status)).map((b) => ({ id: b.id, billNumber: b.billNumber, amountDue: Number(b.amountDue) }))
    : [];

  type L = (typeof cr.lines)[number];
  const columns: Column<L>[] = [
    { key: "desc", header: t("common.description"), render: (l) => <span className="text-ink">{l.description}</span> },
    { key: "qty", header: t("acct.col.qty"), align: "end", render: (l) => <span className="tabular text-ink-3">{num(l.quantity)}</span> },
    { key: "price", header: t("acct.col.unitPrice"), align: "end", render: (l) => <span className="tabular text-ink-3">{num(l.unitPrice)}</span> },
    { key: "tax", header: t("acct.col.tax"), align: "end", render: (l) => <span className="tabular text-ink-3">{Number(l.taxAmount) ? num(l.taxAmount) : "—"}</span> },
    { key: "net", header: t("acct.col.lineTotal"), align: "end", render: (l) => <span className="tabular text-ink">{num(l.lineNet)}</span> },
  ];

  return (
    <>
      <div className="mb-1 text-xs text-ink-3"><Link href={`/accounting/supplier-credits?company=${cr.companyId}`} className="hover:text-ink-2">Supplier Credits</Link> / {cr.creditNumber ?? "draft"}</div>
      <PageHeader title={cr.creditNumber ?? "Draft credit"} description={cr.supplier.name}
        meta={<div className="flex items-center gap-2"><Badge category={STATUS_CAT[cr.status] ?? "neutral"}>{cr.status}</Badge><span className="text-xs text-ink-3">{formatDate(cr.issueDate, locale)}</span></div>}
        actions={<div className="flex items-center gap-2">
          {cr.status === "draft" && canCreate && <PostBillButton id={cr.id} kind="credit" />}
          {cr.status === "open" && canCreate && remaining > 0 && <ApplySupplierCreditButton creditId={cr.id} remaining={remaining} currency={cr.currency} openBills={openBills} />}
          {cr.journalEntryId && <Link href={`/accounting/journal/${cr.journalEntryId}`} className="text-[12px] text-accent hover:underline">View GL entry →</Link>}
        </div>} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_300px]">
        <Panel>
          <PanelHeader title={t("acct.lines")} />
          <DataTable columns={columns} rows={cr.lines} getRowKey={(l) => l.id} />
          <div className="space-y-1 border-t border-line px-4 py-3 text-[13px]">
            <div className="flex justify-end gap-8"><span className="text-ink-3">Subtotal</span><span className="tabular text-ink-2">{num(cr.subtotal)} {cr.currency}</span></div>
            <div className="flex justify-end gap-8"><span className="text-ink-3">Tax</span><span className="tabular text-ink-2">{num(cr.taxTotal)}</span></div>
            <div className="flex justify-end gap-8 font-semibold"><span>Total</span><span className="tabular text-ink">{num(cr.total)}</span></div>
            <div className="flex justify-end gap-8"><span className="text-ink-3">Applied</span><span className="tabular text-ink-2">{num(cr.amountApplied)}</span></div>
            <div className="flex justify-end gap-8 font-semibold"><span>Unapplied</span><span className="tabular text-ink">{num(cr.amountRemaining)}</span></div>
          </div>
        </Panel>
        <div className="space-y-4">
          <Panel>
            <PanelHeader title={t("acct.details")} />
            <dl className="space-y-2 px-4 py-3 text-[13px]">
              <div className="flex justify-between"><dt className="text-ink-3">Supplier</dt><dd className="text-ink">{cr.supplier.name}</dd></div>
              {cr.reason && <div className="flex justify-between"><dt className="text-ink-3">Reason</dt><dd className="text-ink">{cr.reason}</dd></div>}
              <div className="flex justify-between"><dt className="text-ink-3">Currency</dt><dd className="text-ink">{cr.currency}</dd></div>
            </dl>
          </Panel>
          {cr.applications.length > 0 && (
            <Panel>
              <PanelHeader title={t("acct.appliedTo")} />
              <div className="space-y-1.5 px-4 py-3 text-[13px]">
                {cr.applications.map((a) => <div key={a.id} className="flex justify-between"><span className="text-ink-2">{a.bill.billNumber}</span><span className="tabular text-ink">{num(a.amount)}</span></div>)}
              </div>
            </Panel>
          )}
        </div>
      </div>
    </>
  );
}
