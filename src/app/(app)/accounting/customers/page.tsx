import type { Metadata } from "next";
import { Users } from "lucide-react";
import Link from "next/link";
import { pageGuard } from "@/lib/page-guard";
import { getServerI18n } from "@/lib/server-i18n";
import { AccessDenied } from "@/components/access-denied";
import { canAnywhere } from "@/lib/permissions/engine";
import { resolveAccountingCompany } from "@/domain/accounting/access";
import { listCustomers } from "@/domain/accounting/customers";
import { PageHeader, Panel, DataTable, Badge, EmptyState, type Column } from "@/components/ui";
import { CompanyPicker } from "@/components/accounting/company-picker";
import { ExportButton } from "@/components/list/export-button";
import { NewCustomerButton, EditCustomerButton } from "@/components/accounting/ar-controls";

export const metadata: Metadata = { title: "Customers" };

export default async function CustomersPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const { principal, locale, denied } = await pageGuard("ar.view");
  if (denied) return <AccessDenied locale={locale} />;
  const { t } = await getServerI18n();
  const sp = await searchParams;
  const { companies, current } = await resolveAccountingCompany(principal, sp.company);
  if (!current) return <><PageHeader title={t("acct.customers")} /><Panel><EmptyState title={t("acct.noCompany")} /></Panel></>;

  const { rows } = await listCustomers(principal, current.id, { q: sp.q, active: "all", pageSize: 200 }).catch(() => ({ rows: [] as never[] }));
  const canManage = canAnywhere(principal, "ar.create");
  type Row = (typeof rows)[number];

  const columns: Column<Row>[] = [
    { key: "name", header: t("acct.col.customer"), render: (c) => <Link href={`/accounting/invoices?company=${current.id}&customerId=${c.id}`} className="text-ink hover:text-accent">{c.name}</Link> },
    { key: "code", header: t("common.code"), render: (c) => <span className="font-mono text-ink-3">{c.code ?? "—"}</span> },
    { key: "contact", header: t("acct.col.contact"), render: (c) => <span className="text-ink-2">{c.email ?? c.phone ?? "—"}</span> },
    { key: "currency", header: t("common.currency"), align: "center", render: (c) => <span className="text-ink-3">{c.currency ?? current.baseCurrency}</span> },
    { key: "terms", header: t("acct.col.terms"), align: "center", render: (c) => <span className="text-ink-3">{c.paymentTermsDays != null ? `${c.paymentTermsDays}d` : "—"}</span> },
    { key: "status", header: t("common.status"), align: "center", render: (c) => <Badge category={c.isActive ? "success" : "neutral"}>{c.isActive ? t("status.active") : t("status.inactive")}</Badge> },
    ...(canManage ? [{ key: "actions", header: "", align: "end" as const, render: (c: Row) => <EditCustomerButton customer={c} /> }] : []),
  ];

  return (
    <>
      <PageHeader title={t("acct.customers")} description={t("acct.customersSub", { name: current.name })}
        actions={<div className="flex items-center gap-2"><CompanyPicker companies={companies} current={current.id} /><ExportButton resource="customers" />{canManage && <NewCustomerButton companyId={current.id} />}</div>} />
      <Panel>
        <DataTable columns={columns} rows={rows} getRowKey={(c) => c.id}
          empty={<EmptyState icon={<Users className="h-5 w-5" />} title={t("acct.noCustomers")} description={t("acct.noCustomersBody")} />} />
      </Panel>
    </>
  );
}
