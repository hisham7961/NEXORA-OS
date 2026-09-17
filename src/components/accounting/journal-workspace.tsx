"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Check, AlertTriangle } from "lucide-react";
import { Button, Input, Select, Badge } from "@/components/ui";
import { useToast, useI18n } from "@/components/providers";
import { postJournalAction } from "@/app/actions/accounting";

interface AccountOpt { id: string; code: string; name: string; allowPosting: boolean }
interface Line { accountId: string; description: string; debit: string; credit: string }

const emptyLine = (): Line => ({ accountId: "", description: "", debit: "", credit: "" });

/**
 * Journal entry workspace (§96): a spreadsheet-like line editor with running
 * debit/credit totals and a live difference indicator. Posting is blocked while the
 * entry is unbalanced. Server remains authoritative — the posting engine re-validates.
 */
export function JournalWorkspace({ companyId, baseCurrency, accounts, journals }: { companyId: string; baseCurrency: string; accounts: AccountOpt[]; journals: { code: string; name: string }[] }) {
  const router = useRouter();
  const { toast } = useToast(); const { t } = useI18n();
  const [pending, start] = useTransition();
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [journalCode, setJournalCode] = useState(journals[0]?.code ?? "GJ");
  const [memo, setMemo] = useState("");
  const [reference, setReference] = useState("");
  const [lines, setLines] = useState<Line[]>([emptyLine(), emptyLine()]);

  const postable = accounts.filter((a) => a.allowPosting);
  const totals = useMemo(() => {
    let d = 0, c = 0;
    for (const l of lines) { d += Number(l.debit) || 0; c += Number(l.credit) || 0; }
    return { debit: d, credit: c, diff: Math.round((d - c) * 1000) / 1000 };
  }, [lines]);
  const balanced = totals.diff === 0 && totals.debit > 0;
  const filled = lines.filter((l) => l.accountId && (Number(l.debit) > 0 || Number(l.credit) > 0));

  const setLine = (i: number, patch: Partial<Line>) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  const post = () => start(async () => {
    const res = await postJournalAction({
      companyId, journalCode, date, memo: memo || undefined, reference: reference || undefined,
      lines: filled.map((l) => ({ accountId: l.accountId, description: l.description || undefined, debit: Number(l.debit) || 0, credit: Number(l.credit) || 0 })),
    });
    if (res.ok) { toast({ kind: "success", title: t("acct.postedN", { number: res.data?.journalNumber ?? "" }) }); setLines([emptyLine(), emptyLine()]); setMemo(""); setReference(""); router.refresh(); }
    else toast({ kind: "error", title: res.error });
  });

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <label className="block"><span className="mb-1 block text-[12px] text-ink-2">{t("common.date")}</span><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
        <label className="block"><span className="mb-1 block text-[12px] text-ink-2">{t("acct.journal2")}</span><Select value={journalCode} onChange={(e) => setJournalCode(e.target.value)}>{journals.map((j) => <option key={j.code} value={j.code}>{j.code} — {j.name}</option>)}</Select></label>
        <label className="block"><span className="mb-1 block text-[12px] text-ink-2">{t("fin.reference")}</span><Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder={t("acct.optional")} /></label>
        <label className="block"><span className="mb-1 block text-[12px] text-ink-2">{t("acct.memo")}</span><Input value={memo} onChange={(e) => setMemo(e.target.value)} placeholder={t("acct.optional")} /></label>
      </div>

      <div className="overflow-x-auto rounded-md border border-line">
        <table className="w-full text-[13px]">
          <thead className="bg-surface-2 text-[11px] uppercase tracking-wide text-ink-3">
            <tr>
              <th className="px-2 py-1.5 text-start font-medium">{t("acct.col.account")}</th>
              <th className="px-2 py-1.5 text-start font-medium">{t("common.description")}</th>
              <th className="px-2 py-1.5 text-end font-medium">{t("acct.col.debit")}</th>
              <th className="px-2 py-1.5 text-end font-medium">{t("acct.col.credit")}</th>
              <th className="w-8"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {lines.map((l, i) => (
              <tr key={i}>
                <td className="px-2 py-1"><Select value={l.accountId} onChange={(e) => setLine(i, { accountId: e.target.value })} className="h-8 min-w-[180px]"><option value="">{t("acct.selectDots")}</option>{postable.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}</Select></td>
                <td className="px-2 py-1"><Input value={l.description} onChange={(e) => setLine(i, { description: e.target.value })} className="h-8" /></td>
                <td className="px-2 py-1"><Input type="number" step="0.001" min="0" value={l.debit} onChange={(e) => setLine(i, { debit: e.target.value, credit: e.target.value ? "" : l.credit })} className="h-8 text-end tabular" /></td>
                <td className="px-2 py-1"><Input type="number" step="0.001" min="0" value={l.credit} onChange={(e) => setLine(i, { credit: e.target.value, debit: e.target.value ? "" : l.debit })} className="h-8 text-end tabular" /></td>
                <td className="px-1 text-center">{lines.length > 2 && <button className="rounded p-1 text-ink-3 hover:text-critical" onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}><Trash2 className="h-3.5 w-3.5" /></button>}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-surface-2 text-[13px] font-medium">
            <tr>
              <td className="px-2 py-1.5" colSpan={2}><button className="inline-flex items-center gap-1 text-[12px] text-accent hover:underline" onClick={() => setLines((ls) => [...ls, emptyLine()])}><Plus className="h-3.5 w-3.5" /> {t("fin.addLine")}</button></td>
              <td className="px-2 py-1.5 text-end tabular">{totals.debit.toFixed(3)}</td>
              <td className="px-2 py-1.5 text-end tabular">{totals.credit.toFixed(3)}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          {balanced ? (
            <Badge category="success"><Check className="h-3 w-3" /> {t("acct.balanced")}</Badge>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-[13px] text-warning"><AlertTriangle className="h-4 w-4" /> {t("acct.differenceColon")} <span className="tabular">{totals.diff.toFixed(3)}</span> {baseCurrency}</span>
          )}
        </div>
        <Button variant="primary" size="sm" disabled={pending || !balanced || filled.length < 2} onClick={post}>{pending ? t("acct.postingEllipsis") : t("acct.postEntry")}</Button>
      </div>
    </div>
  );
}
