"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Upload, Check, Sparkles } from "lucide-react";
import { Button, Input, Select, Drawer, Textarea, Badge } from "@/components/ui";
import { useToast, useI18n } from "@/components/providers";
import { importStatementAction, confirmMatchAction } from "@/app/actions/bank";

type Bank = { id: string; name: string; currency: string };
type PreviewRow = { index: number; description: string; reference: string | null; amount: string | null; issues: string[]; duplicate: boolean };
type Preview = { rows: PreviewRow[]; summary: { total: number; importable: number; duplicates: number; invalid: number; inflow: string; outflow: string } };

function headerList(csv: string): string[] {
  const firstLine = csv.split(/\r?\n/)[0] ?? "";
  return firstLine.split(",").map((h) => h.trim().replace(/^"|"$/g, "")).filter(Boolean);
}

export function ImportStatementButton({ companyId, banks }: { companyId: string; banks: Bank[] }) {
  const router = useRouter(); const { toast } = useToast(); const { t } = useI18n();
  const [open, setOpen] = useState(false); const [pending, start] = useTransition();
  const [bankAccountId, setBankAccountId] = useState(banks[0]?.id ?? "");
  const [label, setLabel] = useState("");
  const [csvText, setCsvText] = useState("");
  const [m, setM] = useState({ date: "", description: "", reference: "", amount: "", debit: "", credit: "", balance: "" });
  const [preview, setPreview] = useState<Preview | null>(null);
  const headers = headerList(csvText);

  const onFile = (f: File | null) => { if (!f) return; f.text().then((txt) => { setCsvText(txt); setPreview(null); }); };
  const mapping = () => ({ date: m.date, description: m.description, reference: m.reference || undefined, amount: m.amount || undefined, debit: m.debit || undefined, credit: m.credit || undefined, balance: m.balance || undefined });

  const doPreview = () => start(async () => {
    const res = await fetch("/api/v1/accounting/statements/preview", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ companyId, bankAccountId, csvText, mapping: mapping() }) });
    const j = await res.json();
    if (res.ok) setPreview(j.data as Preview); else toast({ kind: "error", title: j?.error?.message ?? t("fin.previewFailed") });
  });
  const doImport = () => start(async () => {
    const r = await importStatementAction(companyId, { bankAccountId, label: label || t("fin.statement"), csvText, mapping: mapping() });
    if (r.ok) { toast({ kind: "success", title: t("fin.importedLines", { count: r.data?.lineCount ?? "" }) }); setOpen(false); setPreview(null); setCsvText(""); router.refresh(); } else toast({ kind: "error", title: r.error });
  });

  const Sel = ({ k, label: lbl, optional }: { k: keyof typeof m; label: string; optional?: boolean }) => (
    <label className="block"><span className="mb-1 block text-[12px] text-ink-2">{lbl}</span>
      <Select value={m[k]} onChange={(e) => { setM({ ...m, [k]: e.target.value }); setPreview(null); }} className="h-8">
        <option value="">{optional ? t("fin.noneOption") : t("fin.selectOption")}</option>{headers.map((h) => <option key={h} value={h}>{h}</option>)}
      </Select></label>
  );

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}><Upload className="h-4 w-4" /> {t("fin.importStatement")}</Button>
      <Drawer open={open} onClose={() => setOpen(false)} title={t("fin.importBankStatement")} description={t("fin.importStatementDesc")} width="640px">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="block"><span className="mb-1 block text-[12px] text-ink-2">{t("fin.bankAccount")}</span><Select value={bankAccountId} onChange={(e) => setBankAccountId(e.target.value)}>{banks.map((b) => <option key={b.id} value={b.id}>{b.name} ({b.currency})</option>)}</Select></label>
            <label className="block"><span className="mb-1 block text-[12px] text-ink-2">{t("fin.statementLabel")}</span><Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder={t("fin.phStatementLabel")} /></label>
          </div>
          <label className="block"><span className="mb-1 block text-[12px] text-ink-2">{t("fin.csvFile")}</span><input type="file" accept=".csv,text/csv" onChange={(e) => onFile(e.target.files?.[0] ?? null)} className="block w-full text-[13px] text-ink-2 file:me-3 file:rounded file:border-0 file:bg-surface-2 file:px-3 file:py-1.5 file:text-ink" /></label>
          <label className="block"><span className="mb-1 block text-[12px] text-ink-2">{t("fin.orPasteCsv")}</span><Textarea value={csvText} onChange={(e) => { setCsvText(e.target.value); setPreview(null); }} rows={4} /* i18n-ignore CSV format example */ placeholder="date,description,reference,amount,balance&#10;2026-01-05,Customer receipt,TT-1,1000,5000" className="font-mono text-[12px]" /></label>
          {headers.length > 0 && (
            <div className="grid grid-cols-2 gap-3 rounded-lg border border-line p-3 sm:grid-cols-4">
              <Sel k="date" label={t("common.date")} /><Sel k="description" label={t("common.description")} /><Sel k="reference" label={t("fin.reference")} optional /><Sel k="balance" label={t("fin.balance")} optional />
              <Sel k="amount" label={t("fin.amountPm")} optional /><Sel k="debit" label={t("fin.debitOut")} optional /><Sel k="credit" label={t("fin.creditIn")} optional />
            </div>
          )}
          {preview && (
            <div className="rounded-lg border border-line">
              <div className="flex flex-wrap gap-3 border-b border-line px-3 py-2 text-[12px]">
                <Badge category="info">{t("fin.importableCount", { count: preview.summary.importable })}</Badge>
                {preview.summary.duplicates > 0 && <Badge category="warning">{t("fin.duplicateCount", { count: preview.summary.duplicates })}</Badge>}
                {preview.summary.invalid > 0 && <Badge category="critical">{t("fin.invalidCount", { count: preview.summary.invalid })}</Badge>}
                <span className="text-ink-3">{t("fin.inOut", { inflow: preview.summary.inflow, outflow: preview.summary.outflow })}</span>
              </div>
              <div className="max-h-48 overflow-y-auto text-[12px]">
                {preview.rows.slice(0, 30).map((r) => (
                  <div key={r.index} className={`flex items-center justify-between gap-2 border-b border-line px-3 py-1 last:border-0 ${r.issues.length ? "text-critical" : r.duplicate ? "text-ink-3 line-through" : "text-ink-2"}`}>
                    <span className="truncate">{r.description}{r.reference ? ` · ${r.reference}` : ""}</span>
                    <span className="tabular">{r.amount ?? "—"}{r.issues.length ? ` (${r.issues.join(", ")})` : r.duplicate ? ` (${t("fin.dup")})` : ""}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
            <Button variant="secondary" size="sm" disabled={pending || !csvText || !m.date || !m.description} onClick={doPreview}>{t("fin.preview")}</Button>
            <Button variant="primary" size="sm" disabled={pending || !preview || preview.summary.importable === 0} onClick={doImport}>{t("fin.importNLines", { count: preview?.summary.importable ?? "" })}</Button>
          </div>
        </div>
      </Drawer>
    </>
  );
}

type Suggestion = { statementLineId: string; statementDesc: string; statementDate: string; amount: string; journalLineId: string; journalNumber: string | null; confidence: number; reason: string };

export function SuggestedMatches({ reconciliationId, completed }: { reconciliationId: string; completed: boolean }) {
  const router = useRouter(); const { toast } = useToast(); const { t } = useI18n();
  const [pending, start] = useTransition();
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null);

  const load = () => start(async () => {
    const res = await fetch(`/api/v1/accounting/reconciliations/${reconciliationId}/suggestions`);
    const j = await res.json();
    if (res.ok) setSuggestions(j.data.suggestions as Suggestion[]); else toast({ kind: "error", title: j?.error?.message ?? t("fin.failedShort") });
  });
  const confirm = (s: Suggestion) => start(async () => {
    const r = await confirmMatchAction(reconciliationId, s.statementLineId, s.journalLineId);
    if (r.ok) { toast({ kind: "success", title: t("fin.matchedCleared") }); setSuggestions((cur) => (cur ?? []).filter((x) => x.statementLineId !== s.statementLineId)); router.refresh(); } else toast({ kind: "error", title: r.error });
  });

  if (completed) return null;
  return (
    <div>
      {suggestions === null ? (
        <Button variant="secondary" size="sm" disabled={pending} onClick={load}><Sparkles className="h-4 w-4" /> {t("fin.suggestMatches")}</Button>
      ) : suggestions.length === 0 ? (
        <p className="text-[13px] text-ink-3">{t("fin.noConfidentMatches")}</p>
      ) : (
        <div className="space-y-1.5">
          {suggestions.map((s) => (
            <div key={s.statementLineId} className="flex items-center justify-between gap-3 rounded-lg border border-line px-3 py-2 text-[13px]">
              <div className="min-w-0">
                <div className="truncate text-ink">{s.statementDesc} <span className="tabular text-ink-2">{s.amount}</span></div>
                <div className="text-[11px] text-ink-3">→ {s.journalNumber} · {s.reason}</div>
              </div>
              <div className="flex items-center gap-2">
                <Badge category={s.confidence >= 85 ? "success" : s.confidence >= 65 ? "info" : "warning"}>{s.confidence}%</Badge>
                <Button variant="primary" size="sm" disabled={pending} onClick={() => confirm(s)}><Check className="h-3.5 w-3.5" /> {t("fin.match")}</Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
