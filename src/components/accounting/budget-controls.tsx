"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { Button, Input, Select } from "@/components/ui";
import { useToast } from "@/components/providers";
import { createBudgetAction, updateBudgetAction, setBudgetStatusAction } from "@/app/actions/budgets";

type AccountOption = { id: string; label: string };
type FyOption = { id: string; name: string };
type LineDraft = { accountId: string; amount: string; month: string };
const MONTHS = ["All", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function fmt(n: number) { return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 3 }); }
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1 block text-[12px] text-ink-2">{label}</span>{children}</label>;
}

export function BudgetComposer({ companyId, accounts, fiscalYears, budget }: { companyId: string; accounts: AccountOption[]; fiscalYears: FyOption[]; budget?: { id: string; name: string; fiscalYearId: string | null; currency: string; periodicity: string; lines: { accountId: string; amount: string; periodMonth: number | null }[] } }) {
  const router = useRouter(); const { toast } = useToast();
  const [pending, start] = useTransition();
  const [name, setName] = useState(budget?.name ?? "");
  const [periodicity, setPeriodicity] = useState(budget?.periodicity ?? "annual");
  const [fiscalYearId, setFiscalYearId] = useState(budget?.fiscalYearId ?? fiscalYears[0]?.id ?? "");
  const [lines, setLines] = useState<LineDraft[]>(budget?.lines.map((l) => ({ accountId: l.accountId, amount: l.amount, month: String(l.periodMonth ?? 0) })) ?? [{ accountId: accounts[0]?.id ?? "", amount: "0", month: "0" }]);

  const total = useMemo(() => lines.reduce((s, l) => s + (Number(l.amount) || 0), 0), [lines]);
  const setLine = (i: number, patch: Partial<LineDraft>) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const valid = lines.filter((l) => l.accountId && l.amount !== "");
  const periodized = periodicity !== "annual";

  const submit = () => start(async () => {
    const payload = { name, periodicity, fiscalYearId: fiscalYearId || undefined, lines: valid.map((l) => ({ accountId: l.accountId, amount: Number(l.amount) || 0, periodMonth: periodized && Number(l.month) > 0 ? Number(l.month) : undefined })) };
    const r = budget ? await updateBudgetAction(budget.id, payload) : await createBudgetAction(companyId, payload);
    if (r.ok) { toast({ kind: "success", title: budget ? "Budget saved" : "Budget created" }); const id = budget?.id ?? (r as { data?: { id: string } }).data?.id; router.push(id ? `/accounting/budgets/${id}` : "/accounting/budgets"); } else toast({ kind: "error", title: r.error });
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label="Budget name"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="FY Operating Budget" /></Field>
        <Field label="Periodicity"><Select value={periodicity} onChange={(e) => setPeriodicity(e.target.value)}><option value="annual">Annual</option><option value="quarterly">Quarterly</option><option value="monthly">Monthly</option></Select></Field>
        <Field label="Fiscal year"><Select value={fiscalYearId} onChange={(e) => setFiscalYearId(e.target.value)}><option value="">— none —</option>{fiscalYears.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</Select></Field>
      </div>
      {periodized && <p className="text-[12px] text-ink-3">Add one line per account per month (choose the month). Lines left as “All” are spread evenly across the year.</p>}
      <div className="overflow-x-auto rounded-lg border border-line">
        <table className="w-full min-w-[560px] text-[13px]">
          <thead><tr className="border-b border-line bg-surface-2 text-[11px] uppercase tracking-wide text-ink-3">
            <th className="px-2 py-2 text-start font-medium">Account</th>
            {periodized && <th className="w-28 px-2 py-2 text-start font-medium">Month</th>}
            <th className="w-40 px-2 py-2 text-end font-medium">Budgeted amount</th>
            <th className="w-8 px-2 py-2"></th>
          </tr></thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={i} className="border-b border-line last:border-0">
                <td className="px-2 py-1.5"><Select value={l.accountId} onChange={(e) => setLine(i, { accountId: e.target.value })} className="h-8">{accounts.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}</Select></td>
                {periodized && <td className="px-2 py-1.5"><Select value={l.month} onChange={(e) => setLine(i, { month: e.target.value })} className="h-8">{MONTHS.map((m, idx) => <option key={m} value={idx}>{m}</option>)}</Select></td>}
                <td className="px-2 py-1.5"><Input value={l.amount} onChange={(e) => setLine(i, { amount: e.target.value })} className="h-8 text-end tabular" /></td>
                <td className="px-2 py-1.5 text-center">{lines.length > 1 && <button className="text-ink-3 hover:text-critical" onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}><Trash2 className="h-3.5 w-3.5" /></button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => setLines((ls) => [...ls, { accountId: accounts[0]?.id ?? "", amount: "0", month: "0" }])}><Plus className="h-4 w-4" /> Add line</Button>
        <div className="text-[13px] font-semibold">Total <span className="ms-2 tabular text-ink">{fmt(total)}</span></div>
      </div>
      <div className="flex justify-end gap-2 border-t border-line pt-3">
        <Button variant="primary" size="sm" disabled={pending || !name || valid.length === 0} onClick={submit}>{budget ? "Save budget" : "Create budget"}</Button>
      </div>
    </div>
  );
}

export function BudgetStatusButton({ id, status }: { id: string; status: string }) {
  const router = useRouter(); const { toast } = useToast();
  const [pending, start] = useTransition();
  const next = status === "active" ? "draft" : "active";
  return (
    <Button variant="secondary" size="sm" disabled={pending} onClick={() => start(async () => {
      const r = await setBudgetStatusAction(id, next as "draft" | "active");
      if (r.ok) { toast({ kind: "success", title: `Budget ${next}` }); router.refresh(); } else toast({ kind: "error", title: r.error });
    })}>{next === "active" ? "Activate" : "Set draft"}</Button>
  );
}
