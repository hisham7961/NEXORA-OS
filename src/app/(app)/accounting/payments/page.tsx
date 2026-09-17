import type { Metadata } from "next";
import { Wallet } from "lucide-react";
import Link from "next/link";
import { pageGuard } from "@/lib/page-guard";
import { getServerI18n } from "@/lib/server-i18n";
import { AccessDenied } from "@/components/access-denied";
import { canAnywhere } from "@/lib/permissions/engine";
import { resolveAccountingCompany } from "@/domain/accounting/access";
import { listPayments, listBills } from "@/domain/accounting/ap";
import { listSuppliers } from "@/domain/accounting/suppliers";
import { PageHeader, Panel, DataTable, EmptyState, type Column } from "@/components/ui";
import { CompanyPicker } from "@/components/accounting/company-picker";
import { RecordPaymentButton } from "@/components/accounting/ap-controls";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Supplier Payments" };

export default async function PaymentsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const { principal, locale, denied } = await pageGuard("payments.view");
  if (denied) return <AccessDenied locale={locale} />;
  const { t } = await getServerI18n();
  const sp = await searchParams;
  const { companies, current } = await resolveAccountingCompany(principal, sp.company);
  if (!current) return <><PageHeader title={t("acct.supplierPayments")} /><Panel><EmptyState title={t("acct.noCompany")} /></Panel></>;

  const canCreate = canAnywhere(principal, "payments.create");
  const [{ rows }, suppliersRes, openBillsRes] = await Promise.all([
    listPayments(principal, current.id, { pageSize: 200 }).catch(() => ({ rows: [] as never[] })),
    canCreate ? listSuppliers(principal, current.id, { active: "active", pageSize: 500 }) : Promise.resolve({ rows: [] as { id: string; name: string }[] }),
    canCreate ? listBills(principal, current.id, { pageSize: 500 }) : Promise.resolve({ rows: [] as { id: string; billNumber: string | null; supplierId: string; amountDue: unknown; status: string }[] }),
  ]);
  const openBills = openBillsRes.rows.filter((b) => ["open", "partially_paid"].includes(b.status)).map((b) => ({ id: b.id, billNumber: b.billNumber, supplierId: b.supplierId, amountDue: Number(b.amountDue) }));

  const num = (v: unknown) => Number(v).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 3 });
  type Row = (typeof rows)[number];
  const columns: Column<Row>[] = [
    { key: "number", header: t("acct.col.number"), render: (r) => <span className="font-mono text-ink">{r.paymentNumber}</span> },
    { key: "supplier", header: t("acct.col.supplier"), render: (r) => <span className="text-ink-2">{r.supplier.name}</span> },
    { key: "date", header: t("common.date"), render: (r) => <span className="text-ink-3">{formatDate(r.paymentDate, locale)}</span> },
    { key: "method", header: t("acct.col.method"), align: "center", render: (r) => <span className="text-ink-3 capitalize">{r.method ?? "—"}</span> },
    { key: "amount", header: t("common.amount"), align: "end", render: (r) => <span className="tabular text-ink-2">{num(r.amount)} {r.currency}</span> },
    { key: "unapplied", header: t("acct.col.unapplied"), align: "end", render: (r) => <span className="tabular text-ink">{Number(r.unappliedAmount) ? num(r.unappliedAmount) : "—"}</span> },
    { key: "gl", header: "", align: "end", render: (r) => r.journalEntryId ? <Link href={`/accounting/journal/${r.journalEntryId}`} className="text-[12px] text-accent hover:underline">{t("acct.glArrow")}</Link> : null },
  ];

  return (
    <>
      <PageHeader title={t("acct.supplierPayments")} description={t("acct.paymentsSub", { name: current.name, cur: current.baseCurrency })}
        actions={<div className="flex items-center gap-2"><CompanyPicker companies={companies} current={current.id} />{canCreate && <RecordPaymentButton companyId={current.id} baseCurrency={current.baseCurrency} suppliers={suppliersRes.rows.map((s) => ({ id: s.id, name: s.name }))} openBills={openBills} />}</div>} />
      <Panel>
        <DataTable columns={columns} rows={rows} getRowKey={(r) => r.id}
          empty={<EmptyState icon={<Wallet className="h-5 w-5" />} title={t("acct.noPayments")} description={t("acct.noPaymentsBody")} />} />
      </Panel>
    </>
  );
}
