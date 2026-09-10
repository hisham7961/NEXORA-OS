import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen } from "lucide-react";
import { pageGuard } from "@/lib/page-guard";
import { getServerI18n } from "@/lib/server-i18n";
import { AccessDenied } from "@/components/access-denied";
import { canAnywhere } from "@/lib/permissions/engine";
import { prisma } from "@/lib/db";
import { resolveAccountingCompany } from "@/domain/accounting/access";
import { PageHeader, Panel, PanelHeader, PanelBody, DataTable, Badge, EmptyState, type Column } from "@/components/ui";
import { CompanyPicker } from "@/components/accounting/company-picker";
import { JournalWorkspace } from "@/components/accounting/journal-workspace";
import { ReverseEntryButton } from "@/components/accounting/setup-controls";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Journal Entries" };

const STATUS_CAT: Record<string, "neutral" | "info" | "success" | "warning" | "critical"> = { posted: "success", reversed: "warning", draft: "neutral", void: "critical" };

export default async function JournalPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const { principal, locale, denied } = await pageGuard("accounting.view");
  if (denied) return <AccessDenied locale={locale} />;
  const { t } = await getServerI18n();
  const sp = await searchParams;
  const { companies, current } = await resolveAccountingCompany(principal, sp.company);
  if (!current) return <><PageHeader title={t("acct.journal")} /><Panel><EmptyState title={t("acct.noCompany")} /></Panel></>;

  const [settings, accounts, journals, entries] = await Promise.all([
    prisma.companyAccountingSettings.findUnique({ where: { companyId: current.id } }),
    prisma.account.findMany({ where: { companyId: current.id, archivedAt: null, isActive: true }, select: { id: true, code: true, name: true, allowPosting: true }, orderBy: { code: "asc" } }),
    prisma.journal.findMany({ where: { companyId: current.id, archivedAt: null }, select: { code: true, name: true }, orderBy: { code: "asc" } }),
    prisma.journalEntry.findMany({ where: { companyId: current.id, status: { in: ["posted", "reversed"] } }, orderBy: { postedAt: "desc" }, take: 25 }),
  ]);
  const canPost = canAnywhere(principal, "accounting.post");
  const canReverse = canAnywhere(principal, "accounting.reverse");

  type Row = (typeof entries)[number];
  const columns: Column<Row>[] = [
    { key: "num", header: t("acct.col.number"), render: (e) => <Link href={`/accounting/journal/${e.id}?company=${current.id}`} className="font-mono text-accent hover:underline">{e.journalNumber}</Link> },
    { key: "date", header: t("common.date"), render: (e) => <span className="tabular text-ink-3">{formatDate(e.postingDate ?? e.date, locale)}</span> },
    { key: "memo", header: "Memo", render: (e) => <span className="text-ink">{e.memo ?? e.reference ?? "—"}</span> },
    { key: "amount", header: t("common.amount"), align: "end", render: (e) => <span className="tabular text-ink">{Number(e.totalDebitBase).toLocaleString(locale, { minimumFractionDigits: 2 })} {e.baseCurrency}</span> },
    { key: "status", header: t("common.status"), render: (e) => <Badge category={STATUS_CAT[e.status] ?? "neutral"}>{e.status}</Badge> },
    { key: "act", header: "", align: "end", render: (e) => (canReverse && e.status === "posted" ? <ReverseEntryButton entryId={e.id} /> : null) },
  ];

  return (
    <>
      <PageHeader title={t("acct.journal")} description={`Post double-entry journals to ${current.name}'s ledger — balanced and immutable.`}
        actions={<CompanyPicker companies={companies} current={current.id} />} />

      {!settings ? (
        <Panel><EmptyState title="Accounting not set up" description="Initialize accounting for this company from the Accounting overview first." /></Panel>
      ) : (
        <div className="space-y-4">
          {canPost && (
            <Panel>
              <PanelHeader title="New journal entry" icon={<BookOpen className="h-4 w-4" />} />
              <PanelBody><JournalWorkspace companyId={current.id} baseCurrency={settings.baseCurrency} accounts={accounts} journals={journals} /></PanelBody>
            </Panel>
          )}
          <Panel>
            <PanelHeader title="Recent entries" />
            <DataTable columns={columns} rows={entries} getRowKey={(e) => e.id} empty={<EmptyState title="No entries yet" description="Posted journals will appear here." />} />
          </Panel>
        </div>
      )}
    </>
  );
}
