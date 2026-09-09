import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { pageGuard } from "@/lib/page-guard";
import { AccessDenied } from "@/components/access-denied";
import { canAnywhere, ForbiddenError } from "@/lib/permissions/engine";
import { getJournalEntry } from "@/domain/accounting/posting";
import { getLookups, refName } from "@/domain/lookups";
import { prisma } from "@/lib/db";
import { PageHeader, Panel, PanelHeader, DataTable, Badge, type Column } from "@/components/ui";
import { ReverseEntryButton } from "@/components/accounting/setup-controls";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Journal Entry" };

const STATUS_CAT: Record<string, "neutral" | "info" | "success" | "warning" | "critical"> = { posted: "success", reversed: "warning", draft: "neutral", void: "critical" };

export default async function JournalEntryPage({ params }: { params: Promise<{ id: string }> }) {
  const { principal, locale, denied } = await pageGuard("accounting.view");
  if (denied) return <AccessDenied locale={locale} />;
  const { id } = await params;
  let entry;
  try { entry = await getJournalEntry(principal, id); } catch (e) { if (e instanceof ForbiddenError) return <AccessDenied locale={locale} />; throw e; }
  if (!entry) notFound();

  const [accounts, lookups] = await Promise.all([
    prisma.account.findMany({ where: { companyId: entry.companyId }, select: { id: true, code: true, name: true } }),
    getLookups(),
  ]);
  const acctName = (aid: string) => { const a = accounts.find((x) => x.id === aid); return a ? `${a.code} ${a.name}` : aid; };

  type L = (typeof entry.lines)[number];
  const columns: Column<L>[] = [
    { key: "account", header: "Account", render: (l) => <span className="text-ink">{acctName(l.accountId)}</span> },
    { key: "desc", header: "Description", render: (l) => <span className="text-ink-2">{l.description ?? "—"}</span> },
    { key: "dims", header: "Dimensions", render: (l) => <span className="text-[11px] text-ink-3">{[l.brandId && refName(lookups.brands, l.brandId), l.countryId && refName(lookups.countries, l.countryId), l.productId && refName(lookups.products, l.productId)].filter(Boolean).join(" · ") || "—"}</span> },
    { key: "debit", header: "Debit", align: "end", render: (l) => <span className="tabular">{Number(l.debit) ? Number(l.debit).toLocaleString(locale, { minimumFractionDigits: 2 }) : ""}</span> },
    { key: "credit", header: "Credit", align: "end", render: (l) => <span className="tabular">{Number(l.credit) ? Number(l.credit).toLocaleString(locale, { minimumFractionDigits: 2 }) : ""}</span> },
  ];

  return (
    <>
      <div className="mb-1 text-xs text-ink-3"><Link href={`/accounting/journal?company=${entry.companyId}`} className="hover:text-ink-2">Journal Entries</Link> / {entry.journalNumber}</div>
      <PageHeader title={entry.journalNumber ?? "Journal Entry"}
        description={entry.memo ?? entry.reference ?? undefined}
        meta={<div className="flex items-center gap-2"><Badge category={STATUS_CAT[entry.status] ?? "neutral"}>{entry.status}</Badge><span className="text-xs text-ink-3">{formatDate(entry.postingDate ?? entry.date, locale)}</span></div>}
        actions={canAnywhere(principal, "accounting.reverse") && entry.status === "posted" ? <ReverseEntryButton entryId={entry.id} /> : undefined} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_280px]">
        <Panel>
          <PanelHeader title="Lines" />
          <DataTable columns={columns} rows={entry.lines} getRowKey={(l) => l.id} />
          <div className="flex justify-end gap-8 border-t border-line px-4 py-2 text-[13px] font-medium">
            <span>Debit <span className="ms-2 tabular text-ink">{Number(entry.totalDebitBase).toLocaleString(locale, { minimumFractionDigits: 2 })}</span></span>
            <span>Credit <span className="ms-2 tabular text-ink">{Number(entry.totalCreditBase).toLocaleString(locale, { minimumFractionDigits: 2 })}</span></span>
          </div>
        </Panel>
        <Panel>
          <PanelHeader title="Details" />
          <dl className="space-y-2 px-4 py-3 text-[13px]">
            <div className="flex justify-between"><dt className="text-ink-3">Currency</dt><dd className="text-ink">{entry.currency}{entry.currency !== entry.baseCurrency ? ` @ ${entry.exchangeRate}` : ""}</dd></div>
            <div className="flex justify-between"><dt className="text-ink-3">Source</dt><dd className="text-ink">{entry.sourceType ?? "ManualJournal"}</dd></div>
            {entry.reversalOfEntryId && <div className="flex justify-between"><dt className="text-ink-3">Reverses</dt><dd><Link href={`/accounting/journal/${entry.reversalOfEntryId}`} className="text-accent hover:underline">original</Link></dd></div>}
            {entry.reversedByEntryId && <div className="flex justify-between"><dt className="text-ink-3">Reversed by</dt><dd><Link href={`/accounting/journal/${entry.reversedByEntryId}`} className="text-accent hover:underline">reversal</Link></dd></div>}
            <div className="flex justify-between"><dt className="text-ink-3">Posted</dt><dd className="text-ink">{formatDate(entry.postedAt, locale)}</dd></div>
          </dl>
        </Panel>
      </div>
    </>
  );
}
