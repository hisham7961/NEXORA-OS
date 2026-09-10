import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { pageGuard } from "@/lib/page-guard";
import { getServerI18n } from "@/lib/server-i18n";
import { AccessDenied } from "@/components/access-denied";
import { canAnywhere, ForbiddenError } from "@/lib/permissions/engine";
import { getReconciliation } from "@/domain/accounting/bank";
import { PageHeader, Panel, PanelHeader, Badge, Metric, EmptyState } from "@/components/ui";
import { ReconcileLineToggle, CompleteReconciliationButton } from "@/components/accounting/bank-controls";
import { SuggestedMatches } from "@/components/accounting/statement-controls";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Reconcile" };

export default async function ReconcilePage({ params }: { params: Promise<{ id: string }> }) {
  const { principal, locale, denied } = await pageGuard("banks.view");
  if (denied) return <AccessDenied locale={locale} />;
  const { t } = await getServerI18n();
  const { id } = await params;
  let data;
  try { data = await getReconciliation(principal, id); } catch (e) { if (e instanceof ForbiddenError) return <AccessDenied locale={locale} />; throw e; }
  if (!data) notFound();
  const { rec, lines } = data;

  const num = (v: unknown) => Number(v).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 3 });
  const canManage = canAnywhere(principal, "banks.manage");
  const completed = rec.status === "completed";
  const cleared = Number(rec.clearedBalance);
  const statement = Number(rec.statementBalance);
  const diff = statement - cleared;
  const balanced = Math.abs(diff) < 0.0005;

  return (
    <>
      <div className="mb-1 text-xs text-ink-3"><Link href={`/accounting/bank?company=${rec.companyId}`} className="hover:text-ink-2">Bank &amp; Cash</Link> / Reconcile</div>
      <PageHeader title={`Reconcile — ${rec.bankAccount.name}`} description={`Statement ${formatDate(rec.statementDate, locale)}`}
        meta={<Badge category={completed ? "success" : "warning"}>{rec.status}</Badge>}
        actions={!completed && canManage ? <CompleteReconciliationButton id={rec.id} balanced={balanced} /> : undefined} />

      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Metric label="Statement balance" value={num(statement)} />
        <Metric label="Cleared balance" value={num(cleared)} category={balanced ? "success" : "warning"} />
        <Metric label="Difference" value={num(diff)} category={balanced ? "success" : "critical"} />
      </div>

      {!completed && canManage && (
        <Panel className="mb-4">
          <PanelHeader title={t("acct.suggestedMatches")} description="Imported statement lines matched to unreconciled ledger lines by amount, date and reference." />
          <div className="px-4 py-3"><SuggestedMatches reconciliationId={rec.id} completed={completed} /></div>
        </Panel>
      )}

      <Panel>
        <PanelHeader title={t("acct.ledgerLines")} action={<span className="text-[12px] text-ink-3">{lines.filter((l) => l.reconciliationId).length} / {lines.length} cleared</span>} />
        {lines.length === 0 ? <EmptyState title="No unreconciled lines" description="No posted ledger movements on this account up to the statement date." /> : (
          <div className="divide-y divide-line">
            {lines.map((l) => {
              const isCleared = !!l.reconciliationId;
              const amt = Number(l.debit) - Number(l.credit);
              return (
                <div key={l.id} className="flex items-center gap-3 px-4 py-2 text-[13px]">
                  {canManage && !completed ? <ReconcileLineToggle reconciliationId={rec.id} journalLineId={l.id} cleared={isCleared} /> : <span className={`inline-block h-2 w-2 rounded-full ${isCleared ? "bg-success" : "bg-line"}`} />}
                  <Link href={`/accounting/journal/${l.entryId}`} className="w-28 font-mono text-ink-2 hover:text-accent">{l.entry.journalNumber}</Link>
                  <span className="w-24 text-ink-3">{formatDate(l.entry.postingDate ?? null, locale)}</span>
                  <span className="flex-1 truncate text-ink-2">{l.description ?? l.entry.memo ?? "—"}</span>
                  <span className={`tabular ${amt >= 0 ? "text-success" : "text-critical"}`}>{amt >= 0 ? "+" : ""}{num(amt)}</span>
                </div>
              );
            })}
          </div>
        )}
      </Panel>
    </>
  );
}
