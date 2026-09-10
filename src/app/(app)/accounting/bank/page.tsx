import type { Metadata } from "next";
import { Landmark } from "lucide-react";
import Link from "next/link";
import { pageGuard } from "@/lib/page-guard";
import { AccessDenied } from "@/components/access-denied";
import { canAnywhere } from "@/lib/permissions/engine";
import { resolveAccountingCompany } from "@/domain/accounting/access";
import { listBankAccounts, listTransfers, listReconciliations, cashPosition } from "@/domain/accounting/bank";
import { prisma } from "@/lib/db";
import { PageHeader, Panel, PanelHeader, DataTable, Badge, EmptyState, Metric, type Column } from "@/components/ui";
import { CompanyPicker } from "@/components/accounting/company-picker";
import { NewBankAccountButton, EditBankAccountButton, TransferButton, NewReconciliationButton } from "@/components/accounting/bank-controls";
import { ImportStatementButton } from "@/components/accounting/statement-controls";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Bank & Cash" };

export default async function BankPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const { principal, locale, denied } = await pageGuard("banks.view");
  if (denied) return <AccessDenied locale={locale} />;
  const sp = await searchParams;
  const { companies, current } = await resolveAccountingCompany(principal, sp.company);
  if (!current) return <><PageHeader title="Bank & Cash" /><Panel><EmptyState title="No company in scope" /></Panel></>;

  const canManage = canAnywhere(principal, "banks.manage");
  const [accounts, position, transfers, recs, postable] = await Promise.all([
    listBankAccounts(principal, current.id, true),
    cashPosition(principal, current.id),
    listTransfers(principal, current.id),
    listReconciliations(principal, current.id),
    canManage ? prisma.account.findMany({ where: { companyId: current.id, isActive: true, allowPosting: true, archivedAt: null, type: "asset" }, select: { id: true, code: true, name: true }, orderBy: { code: "asc" } }) : Promise.resolve([] as { id: string; code: string; name: string }[]),
  ]);
  const num = (v: unknown) => Number(v).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 3 });
  const cur = current.baseCurrency;
  const accountOptions = postable.map((a) => ({ id: a.id, label: `${a.code} ${a.name}` }));
  const bankOptions = accounts.filter((a) => a.isActive).map((a) => ({ id: a.id, name: a.name, currency: a.currency }));

  const acctCols: Column<(typeof accounts)[number]>[] = [
    { key: "name", header: "Account", render: (a) => <span className="text-ink">{a.name}</span> },
    { key: "type", header: "Type", align: "center", render: (a) => <Badge category={a.type === "cash" ? "neutral" : "info"}>{a.type}</Badge> },
    { key: "currency", header: "Currency", align: "center", render: (a) => <span className="text-ink-3">{a.currency}</span> },
    { key: "balance", header: `Book balance (${cur})`, align: "end", render: (a) => { const r = position.rows.find((p) => p.id === a.id); return <span className="tabular text-ink">{r ? num(r.balance) : "—"}</span>; } },
    { key: "status", header: "Status", align: "center", render: (a) => <Badge category={a.isActive ? "success" : "neutral"}>{a.isActive ? "active" : "inactive"}</Badge> },
    ...(canManage ? [{ key: "act", header: "", align: "end" as const, render: (a: (typeof accounts)[number]) => <EditBankAccountButton account={a} accounts={accountOptions} /> }] : []),
  ];

  return (
    <>
      <PageHeader title="Bank & Cash" description={`Accounts, transfers and reconciliation for ${current.name} (${cur}).`}
        actions={<div className="flex items-center gap-2"><CompanyPicker companies={companies} current={current.id} />
          {canManage && bankOptions.length >= 2 && <TransferButton companyId={current.id} banks={bankOptions} />}
          {canManage && bankOptions.length >= 1 && <ImportStatementButton companyId={current.id} banks={bankOptions} />}
          {canManage && bankOptions.length >= 1 && <NewReconciliationButton companyId={current.id} banks={bankOptions} />}
          {canManage && <NewBankAccountButton companyId={current.id} accounts={accountOptions} />}</div>} />

      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Metric label="Cash & bank (book)" value={`${num(position.baseTotal)} ${cur}`} category="info" />
        <Metric label="Accounts" value={String(accounts.length)} />
        <Metric label="Open reconciliations" value={String(recs.filter((r) => r.status === "open").length)} />
      </div>

      <Panel className="mb-4">
        <PanelHeader title="Accounts" icon={<Landmark className="h-4 w-4" />} />
        <DataTable columns={acctCols} rows={accounts} getRowKey={(a) => a.id} empty={<EmptyState title="No accounts" description="Add a bank or cash account mapped to a GL account." />} />
      </Panel>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel>
          <PanelHeader title="Recent transfers" />
          <DataTable
            columns={[
              { key: "num", header: "Number", render: (t: (typeof transfers)[number]) => <span className="font-mono text-ink-2">{t.transferNumber}</span> },
              { key: "route", header: "From → To", render: (t: (typeof transfers)[number]) => <span className="text-ink-2">{t.fromBankAccount.name} → {t.toBankAccount.name}</span> },
              { key: "amt", header: "Amount", align: "end", render: (t: (typeof transfers)[number]) => <span className="tabular text-ink">{num(t.fromAmount)} {t.fromCurrency}</span> },
              { key: "date", header: "Date", align: "end", render: (t: (typeof transfers)[number]) => <span className="text-ink-3">{formatDate(t.date, locale)}</span> },
            ]}
            rows={transfers.slice(0, 10)} getRowKey={(t) => t.id} empty={<EmptyState title="No transfers" />} />
        </Panel>
        <Panel>
          <PanelHeader title="Reconciliations" />
          <DataTable
            columns={[
              { key: "bank", header: "Account", render: (r: (typeof recs)[number]) => <Link href={`/accounting/bank/reconcile/${r.id}`} className="text-ink hover:text-accent">{r.bankAccount.name}</Link> },
              { key: "date", header: "Statement", render: (r: (typeof recs)[number]) => <span className="text-ink-3">{formatDate(r.statementDate, locale)}</span> },
              { key: "bal", header: "Statement bal.", align: "end", render: (r: (typeof recs)[number]) => <span className="tabular text-ink-2">{num(r.statementBalance)}</span> },
              { key: "status", header: "Status", align: "center", render: (r: (typeof recs)[number]) => <Badge category={r.status === "completed" ? "success" : "warning"}>{r.status}</Badge> },
            ]}
            rows={recs.slice(0, 10)} getRowKey={(r) => r.id} empty={<EmptyState title="No reconciliations" />} />
        </Panel>
      </div>
    </>
  );
}
