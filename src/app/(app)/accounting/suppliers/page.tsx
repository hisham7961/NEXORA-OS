import type { Metadata } from "next";
import { Building2 } from "lucide-react";
import Link from "next/link";
import { pageGuard } from "@/lib/page-guard";
import { getServerI18n } from "@/lib/server-i18n";
import { AccessDenied } from "@/components/access-denied";
import { canAnywhere } from "@/lib/permissions/engine";
import { resolveAccountingCompany } from "@/domain/accounting/access";
import { listSuppliers } from "@/domain/accounting/suppliers";
import { PageHeader, Panel, DataTable, Badge, EmptyState, type Column } from "@/components/ui";
import { CompanyPicker } from "@/components/accounting/company-picker";
import { ExportButton } from "@/components/list/export-button";
import { NewSupplierButton, EditSupplierButton } from "@/components/accounting/ap-controls";

export const metadata: Metadata = { title: "Suppliers" };

export default async function SuppliersPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const { principal, locale, denied } = await pageGuard("ap.view");
  if (denied) return <AccessDenied locale={locale} />;
  const { t } = await getServerI18n();
  const sp = await searchParams;
  const { companies, current } = await resolveAccountingCompany(principal, sp.company);
  if (!current) return <><PageHeader title={t("acct.suppliers")} /><Panel><EmptyState title={t("acct.noCompany")} /></Panel></>;

  const { rows } = await listSuppliers(principal, current.id, { q: sp.q, active: "all", pageSize: 200 }).catch(() => ({ rows: [] as never[] }));
  const canManage = canAnywhere(principal, "ap.create");
  type Row = (typeof rows)[number];

  const columns: Column<Row>[] = [
    { key: "name", header: t("acct.col.supplier"), render: (s) => <Link href={`/accounting/bills?company=${current.id}&supplierId=${s.id}`} className="text-ink hover:text-accent">{s.name}</Link> },
    { key: "code", header: t("common.code"), render: (s) => <span className="font-mono text-ink-3">{s.code ?? "—"}</span> },
    { key: "contact", header: t("acct.col.contact"), render: (s) => <span className="text-ink-2">{s.email ?? s.phone ?? "—"}</span> },
    { key: "currency", header: t("common.currency"), align: "center", render: (s) => <span className="text-ink-3">{s.currency ?? current.baseCurrency}</span> },
    { key: "terms", header: t("acct.col.terms"), align: "center", render: (s) => <span className="text-ink-3">{s.paymentTermsDays != null ? `${s.paymentTermsDays}d` : "—"}</span> },
    { key: "status", header: t("common.status"), align: "center", render: (s) => <Badge category={s.isActive ? "success" : "neutral"}>{s.isActive ? "active" : "inactive"}</Badge> },
    ...(canManage ? [{ key: "actions", header: "", align: "end" as const, render: (s: Row) => <EditSupplierButton supplier={s} /> }] : []),
  ];

  return (
    <>
      <PageHeader title={t("acct.suppliers")} description={`Accounts payable parties for ${current.name}.`}
        actions={<div className="flex items-center gap-2"><CompanyPicker companies={companies} current={current.id} /><ExportButton resource="suppliers" />{canManage && <NewSupplierButton companyId={current.id} />}</div>} />
      <Panel>
        <DataTable columns={columns} rows={rows} getRowKey={(s) => s.id}
          empty={<EmptyState icon={<Building2 className="h-5 w-5" />} title="No suppliers" description="Add a supplier to record bills." />} />
      </Panel>
    </>
  );
}
