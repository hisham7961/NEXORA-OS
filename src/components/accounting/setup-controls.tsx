"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Rocket, Plus, CalendarPlus, RotateCcw } from "lucide-react";
import { Button, Input, Select, Drawer } from "@/components/ui";
import { useToast, useI18n } from "@/components/providers";
import { setupAccountingAction, createAccountAction, createFiscalYearAction, setPeriodStatusAction, reverseEntryAction } from "@/app/actions/accounting";

const ACCOUNT_TYPES = ["asset", "liability", "equity", "revenue", "cogs", "expense", "other_income", "other_expense"] as const;

export function SetupAccountingButton({ companyId, baseCurrency }: { companyId: string; baseCurrency: string }) {
  const router = useRouter();
  const { toast } = useToast(); const { t } = useI18n();
  const [pending, start] = useTransition();
  return (
    <Button variant="primary" size="sm" disabled={pending} onClick={() => start(async () => {
      const r = await setupAccountingAction(companyId, baseCurrency);
      if (r.ok) { toast({ kind: "success", title: t("fin.accountingInitialized") }); router.refresh(); } else toast({ kind: "error", title: r.error });
    })}><Rocket className="h-4 w-4" /> {t("fin.setupAccounting")}</Button>
  );
}

export function NewAccountButton({ companyId }: { companyId: string }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { toast } = useToast(); const { t } = useI18n();
  const [pending, start] = useTransition();
  const [f, setF] = useState({ code: "", name: "", type: "expense", subtype: "" });
  return (
    <>
      <Button variant="primary" size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> {t("fin.newAccount")}</Button>
      <Drawer open={open} onClose={() => setOpen(false)} title={t("fin.newAccount")} width="520px">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="block"><span className="mb-1 block text-[12px] text-ink-2">{t("common.code")}</span><Input value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} placeholder="6600" /></label>
            <label className="block"><span className="mb-1 block text-[12px] text-ink-2">{t("fin.type")}</span><Select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>{ACCOUNT_TYPES.map((ty) => <option key={ty} value={ty}>{t(`fin.acctType.`)}</option>)}</Select></label>
          </div>
          <label className="block"><span className="mb-1 block text-[12px] text-ink-2">{t("common.name")}</span><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
          <label className="block"><span className="mb-1 block text-[12px] text-ink-2">{t("fin.subtypeOptional")}</span><Input value={f.subtype} onChange={(e) => setF({ ...f, subtype: e.target.value })} /></label>
          <div className="flex justify-end gap-2"><Button variant="ghost" size="sm" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
            <Button variant="primary" size="sm" disabled={pending || !f.code || !f.name} onClick={() => start(async () => {
              const r = await createAccountAction(companyId, { code: f.code, name: f.name, type: f.type, subtype: f.subtype || undefined });
              if (r.ok) { toast({ kind: "success", title: t("fin.accountCreated") }); setOpen(false); setF({ code: "", name: "", type: "expense", subtype: "" }); router.refresh(); } else toast({ kind: "error", title: r.error });
            })}>{t("common.create")}</Button>
          </div>
        </div>
      </Drawer>
    </>
  );
}

export function NewFiscalYearButton({ companyId }: { companyId: string }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { toast } = useToast(); const { t } = useI18n();
  const [pending, start] = useTransition();
  const year = new Date().getFullYear();
  const [f, setF] = useState({ name: `FY${year}`, startDate: `${year}-01-01`, endDate: `${year}-12-31` });
  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}><CalendarPlus className="h-4 w-4" /> {t("fin.newFiscalYear")}</Button>
      <Drawer open={open} onClose={() => setOpen(false)} title={t("fin.newFiscalYear")} description={t("fin.fiscalYearDesc")} width="480px">
        <div className="space-y-3">
          <label className="block"><span className="mb-1 block text-[12px] text-ink-2">{t("common.name")}</span><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block"><span className="mb-1 block text-[12px] text-ink-2">{t("fin.start")}</span><Input type="date" value={f.startDate} onChange={(e) => setF({ ...f, startDate: e.target.value })} /></label>
            <label className="block"><span className="mb-1 block text-[12px] text-ink-2">{t("fin.end")}</span><Input type="date" value={f.endDate} onChange={(e) => setF({ ...f, endDate: e.target.value })} /></label>
          </div>
          <div className="flex justify-end gap-2"><Button variant="ghost" size="sm" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
            <Button variant="primary" size="sm" disabled={pending} onClick={() => start(async () => {
              const r = await createFiscalYearAction(companyId, f);
              if (r.ok) { toast({ kind: "success", title: t("fin.fiscalYearCreated") }); setOpen(false); router.refresh(); } else toast({ kind: "error", title: r.error });
            })}>{t("common.create")}</Button>
          </div>
        </div>
      </Drawer>
    </>
  );
}

export function PeriodStatusButton({ periodId, status }: { periodId: string; status: string }) {
  const router = useRouter();
  const { toast } = useToast(); const { t } = useI18n();
  const [pending, start] = useTransition();
  const next = status === "open" ? "closed" : "open";
  const run = () => start(async () => {
    const note = next === "open" ? window.prompt(t("fin.reopenPeriodPrompt")) ?? "" : undefined;
    if (next === "open" && !note) return;
    const r = await setPeriodStatusAction(periodId, next, note);
    if (r.ok) { toast({ kind: "success", title: next === "open" ? t("fin.periodOpened") : t("fin.periodClosed") }); router.refresh(); } else toast({ kind: "error", title: r.error });
  });
  return <button className="text-[11px] text-accent hover:underline" disabled={pending} onClick={run}>{next === "closed" ? t("fin.close") : t("fin.reopen")}</button>;
}

export function ReverseEntryButton({ entryId }: { entryId: string }) {
  const router = useRouter();
  const { toast } = useToast(); const { t } = useI18n();
  const [pending, start] = useTransition();
  return (
    <Button size="sm" variant="ghost" disabled={pending} onClick={() => start(async () => {
      const reason = window.prompt(t("fin.reversalReason"));
      if (!reason) return;
      const r = await reverseEntryAction(entryId, reason);
      if (r.ok) { toast({ kind: "success", title: t("fin.entryReversed") }); router.refresh(); } else toast({ kind: "error", title: r.error });
    })}><RotateCcw className="h-3.5 w-3.5" /> {t("fin.reverse")}</Button>
  );
}
