import type { Metadata } from "next";
import { Users } from "lucide-react";
import Link from "next/link";
import { pageGuard } from "@/lib/page-guard";
import { AccessDenied } from "@/components/access-denied";
import { canAnywhere } from "@/lib/permissions/engine";
import { resolveAccountingCompany } from "@/domain/accounting/access";
import { listCustomers } from "@/domain/accounting/customers";
import { PageHeader, Panel, DataTable, Badge, EmptyState, type Column } from "@/components/ui";
import { CompanyPicker } from "@/components/accounting/company-picker";
import { NewCustomerButton, EditCustomerButton } from "@/components/accounting/ar-controls";

export const metadata: Metadata = { title: "Customers" };

export default async function CustomersPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const { principal, locale, denied } = await pageGuard("ar.view");
  if (denied) return <AccessDenied locale={locale} />;
  const sp = await searchParams;
  const { companies, current } = await resolveAccountingCompany(principal, sp.company);
  if (!current) return <><PageHeader title="Customers" /><Panel><EmptyState title="No company in scope" /></Panel></>;

  const { rows } = await listCustomers(principal, current.id, { q: sp.q, active: "all", pageSize: 200 }).catch(() => ({ rows: [] as never[] }));
  const canManage = canAnywhere(principal, "ar.create");
  type Row = (typeof rows)[number];

  const columns: Column<Row>[] = [
    { key: "name", header: "Customer", render: (c) => <Link href={`/accounting/invoices?company=${current.id}&customerId=${c.id}`} className="text-ink hover:text-accent">{c.name}</Link> },
    { key: "code", header: "Code", render: (c) => <span className="font-mono text-ink-3">{c.code ?? "—"}</span> },
    { key: "contact", header: "Contact", render: (c) => <span className="text-ink-2">{c.email ?? c.phone ?? "—"}</span> },
    { key: "currency", header: "Currency", align: "center", render: (c) => <span className="text-ink-3">{c.currency ?? current.baseCurrency}</span> },
    { key: "terms", header: "Terms", align: "center", render: (c) => <span className="text-ink-3">{c.paymentTermsDays != null ? `${c.paymentTermsDays}d` : "—"}</span> },
    { key: "status", header: "Status", align: "center", render: (c) => <Badge category={c.isActive ? "success" : "neutral"}>{c.isActive ? "active" : "inactive"}</Badge> },
    ...(canManage ? [{ key: "actions", header: "", align: "end" as const, render: (c: Row) => <EditCustomerButton customer={c} /> }] : []),
  ];

  return (
    <>
      <PageHeader title="Customers" description={`Accounts receivable parties for ${current.name}.`}
        actions={<div className="flex items-center gap-2"><CompanyPicker companies={companies} current={current.id} />{canManage && <NewCustomerButton companyId={current.id} />}</div>} />
      <Panel>
        <DataTable columns={columns} rows={rows} getRowKey={(c) => c.id}
          empty={<EmptyState icon={<Users className="h-5 w-5" />} title="No customers" description="Add a customer to start invoicing." />} />
      </Panel>
    </>
  );
}
