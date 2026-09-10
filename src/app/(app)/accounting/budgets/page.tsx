import type { Metadata } from "next";
import { PieChart, Plus } from "lucide-react";
import Link from "next/link";
import { pageGuard } from "@/lib/page-guard";
import { AccessDenied } from "@/components/access-denied";
import { canAnywhere } from "@/lib/permissions/engine";
import { resolveAccountingCompany } from "@/domain/accounting/access";
import { listBudgets } from "@/domain/accounting/budgets";
import { PageHeader, Panel, DataTable, Badge, EmptyState, Button, type Column } from "@/components/ui";
import { CompanyPicker } from "@/components/accounting/company-picker";

export const metadata: Metadata = { title: "Budgets" };

const STATUS_CAT: Record<string, "neutral" | "info" | "success" | "warning" | "critical"> = { draft: "neutral", active: "success", archived: "neutral" };

export default async function BudgetsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const { principal, locale, denied } = await pageGuard("budgets.view");
  if (denied) return <AccessDenied locale={locale} />;
  const sp = await searchParams;
  const { companies, current } = await resolveAccountingCompany(principal, sp.company);
  if (!current) return <><PageHeader title="Budgets" /><Panel><EmptyState title="No company in scope" /></Panel></>;

  const budgets = await listBudgets(principal, current.id).catch(() => []);
  const canManage = canAnywhere(principal, "budgets.manage");
  const num = (v: unknown) => Number(v).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 3 });
  type Row = (typeof budgets)[number];

  const columns: Column<Row>[] = [
    { key: "name", header: "Budget", render: (b) => <Link href={`/accounting/budgets/${b.id}`} className="text-ink hover:text-accent">{b.name}</Link> },
    { key: "lines", header: "Accounts", align: "center", render: (b) => <span className="text-ink-3">{b._count.lines}</span> },
    { key: "amount", header: "Total", align: "end", render: (b) => <span className="tabular text-ink-2">{num(b.amount)} {b.currency}</span> },
    { key: "status", header: "Status", align: "center", render: (b) => <Badge category={STATUS_CAT[b.status] ?? "neutral"}>{b.status}</Badge> },
  ];

  return (
    <>
      <PageHeader title="Budgets" description={`Budget vs actual for ${current.name} (${current.baseCurrency}).`}
        actions={<div className="flex items-center gap-2"><CompanyPicker companies={companies} current={current.id} />{canManage && <Link href={`/accounting/budgets/new?company=${current.id}`}><Button variant="primary" size="sm"><Plus className="h-4 w-4" /> New budget</Button></Link>}</div>} />
      <Panel>
        <DataTable columns={columns} rows={budgets} getRowKey={(b) => b.id}
          empty={<EmptyState icon={<PieChart className="h-5 w-5" />} title="No budgets" description="Create a budget to track spend against plan." />} />
      </Panel>
    </>
  );
}
