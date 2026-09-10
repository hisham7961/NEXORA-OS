"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Landmark, CheckCircle2 } from "lucide-react";
import { Button, Input, Select, Label } from "@/components/ui";
import { useToast } from "@/components/providers";
import { postOpeningBalancesAction } from "@/app/actions/opening-balances";

export interface OpeningAccount { id: string; code: string; name: string; type: string }

/**
 * Opening-balance entry (§group-rollout go-live). Enter a debit or credit per account
 * for a company migrating in mid-life; the residual balances to a chosen Opening
 * Balance Equity account, so the entry always posts balanced. Available once per
 * company — a posted state is shown read-only thereafter.
 */
export function OpeningBalancesForm({
  companyId, accounts, baseCurrency, alreadyPosted,
}: {
  companyId: string;
  accounts: OpeningAccount[];
  baseCurrency: string;
  alreadyPosted: { posted: boolean; entryId: string | null; postedAt: string | null };
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().slice(0, 10));
  const [equityAccountId, setEquityAccountId] = useState(accounts.find((a) => a.type === "equity")?.id ?? "");
  const [amounts, setAmounts] = useState<Record<string, { debit: string; credit: string }>>({});

  const equityAccounts = accounts.filter((a) => a.type === "equity" || a.type === "liability");

  const { totalDebit, totalCredit, residual } = useMemo(() => {
    let d = 0, c = 0;
    for (const [id, v] of Object.entries(amounts)) {
      if (id === equityAccountId) continue;
      d += Number(v.debit) || 0; c += Number(v.credit) || 0;
    }
    return { totalDebit: d, totalCredit: c, residual: d - c };
  }, [amounts, equityAccountId]);

  const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const setAmt = (id: string, side: "debit" | "credit", val: string) =>
    setAmounts((p) => ({ ...p, [id]: { debit: side === "debit" ? val : "", credit: side === "credit" ? val : "" } }));

  const post = () => {
    if (!equityAccountId) { toast({ kind: "error", title: "Choose an opening-equity account" }); return; }
    const lines = Object.entries(amounts)
      .filter(([id]) => id !== equityAccountId)
      .map(([accountId, v]) => ({ accountId, debit: Number(v.debit) || 0, credit: Number(v.credit) || 0 }))
      .filter((l) => l.debit > 0 || l.credit > 0);
    if (lines.length === 0) { toast({ kind: "error", title: "Enter at least one opening balance" }); return; }
    start(async () => {
      const r = await postOpeningBalancesAction(companyId, { asOfDate, equityAccountId, lines });
      if (r.ok && r.data) { toast({ kind: "success", title: `Opening balances posted (${r.data.number})` }); router.refresh(); }
      else toast({ kind: "error", title: r.ok ? "Failed" : r.error });
    });
  };

  if (alreadyPosted.posted) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-success/30 bg-success-soft/40 p-4 text-[13px] text-success">
        <CheckCircle2 className="h-5 w-5 shrink-0" />
        <div>
          Opening balances were posted{alreadyPosted.postedAt ? ` on ${new Date(alreadyPosted.postedAt).toLocaleDateString()}` : ""}. They are entered once per company.
          {alreadyPosted.entryId && <> View the <a className="underline" href={`/accounting/journal/${alreadyPosted.entryId}`}>opening journal entry</a>. To redo them, reverse that entry first.</>}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div><Label htmlFor="ob-date">As of date</Label><Input id="ob-date" type="date" value={asOfDate} onChange={(e) => setAsOfDate(e.target.value)} /></div>
        <div className="sm:col-span-2">
          <Label htmlFor="ob-equity">Opening-equity account (balances the entry)</Label>
          <Select id="ob-equity" value={equityAccountId} onChange={(e) => setEquityAccountId(e.target.value)}>
            <option value="">Select…</option>
            {equityAccounts.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
          </Select>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-line">
        <table className="w-full text-[13px]">
          <thead className="bg-surface-2/60 text-[11px] uppercase tracking-wide text-ink-3">
            <tr><th className="px-3 py-2 text-start">Account</th><th className="px-3 py-2 text-end">Debit</th><th className="px-3 py-2 text-end">Credit</th></tr>
          </thead>
          <tbody className="divide-y divide-line">
            {accounts.filter((a) => a.id !== equityAccountId).map((a) => (
              <tr key={a.id}>
                <td className="px-3 py-1.5"><span className="font-mono text-[11px] text-ink-3">{a.code}</span> {a.name}</td>
                <td className="px-3 py-1.5 text-end"><Input type="number" step="0.01" min="0" className="w-32 text-end tabular" value={amounts[a.id]?.debit ?? ""} onChange={(e) => setAmt(a.id, "debit", e.target.value)} /></td>
                <td className="px-3 py-1.5 text-end"><Input type="number" step="0.01" min="0" className="w-32 text-end tabular" value={amounts[a.id]?.credit ?? ""} onChange={(e) => setAmt(a.id, "credit", e.target.value)} /></td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-surface-2/40 text-[12px] font-medium">
            <tr><td className="px-3 py-2 text-end">Totals</td><td className="px-3 py-2 text-end tabular">{fmt(totalDebit)}</td><td className="px-3 py-2 text-end tabular">{fmt(totalCredit)}</td></tr>
            <tr><td className="px-3 py-2 text-end text-ink-3">To opening equity ({baseCurrency})</td><td colSpan={2} className="px-3 py-2 text-end tabular text-accent">{residual === 0 ? "balanced" : `${residual > 0 ? "credit" : "debit"} ${fmt(Math.abs(residual))}`}</td></tr>
          </tfoot>
        </table>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="primary" disabled={pending || !equityAccountId} onClick={post}><Landmark className="h-4 w-4" /> Post opening balances</Button>
        <span className="text-[12px] text-ink-3">The residual posts to the equity account so the entry balances.</span>
      </div>
    </div>
  );
}
