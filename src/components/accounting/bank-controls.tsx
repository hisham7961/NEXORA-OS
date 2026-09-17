"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, ArrowLeftRight, ClipboardCheck, Check } from "lucide-react";
import { Button, Input, Select, Drawer } from "@/components/ui";
import { useToast, useI18n } from "@/components/providers";
import { createBankAccountAction, updateBankAccountAction, setBankAccountActiveAction, createTransferAction, createReconciliationAction, setLineReconciledAction, completeReconciliationAction } from "@/app/actions/bank";

type Bank = { id: string; name: string; currency: string };
type AccountOption = { id: string; label: string };
function fmt(n: number) { return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 3 }); }
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1 block text-[12px] text-ink-2">{label}</span>{children}</label>;
}

export function NewBankAccountButton({ companyId, accounts }: { companyId: string; accounts: AccountOption[] }) {
  const router = useRouter(); const { toast } = useToast(); const { t } = useI18n();
  const [open, setOpen] = useState(false); const [pending, start] = useTransition();
  const [f, setF] = useState({ name: "", type: "bank", currency: "KWD", glAccountId: accounts[0]?.id ?? "", number: "", bankName: "", iban: "" });
  return (
    <>
      <Button variant="primary" size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> {t("fin.newAccount")}</Button>
      <Drawer open={open} onClose={() => setOpen(false)} title={t("fin.newBankCashAccount")} width="520px">
        <div className="space-y-3">
          <Field label={t("common.name")}><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label={t("fin.type")}><Select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}><option value="bank">{t("fin.method.bank")}</option><option value="cash">{t("fin.method.cash")}</option></Select></Field>
            <Field label={t("common.currency")}><Input value={f.currency} maxLength={3} onChange={(e) => setF({ ...f, currency: e.target.value.toUpperCase() })} /></Field>
            <Field label={t("fin.number")}><Input value={f.number} onChange={(e) => setF({ ...f, number: e.target.value })} /></Field>
          </div>
          <Field label={t("fin.glAccount")}><Select value={f.glAccountId} onChange={(e) => setF({ ...f, glAccountId: e.target.value })}>{accounts.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}</Select></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("fin.bankName")}><Input value={f.bankName} onChange={(e) => setF({ ...f, bankName: e.target.value })} /></Field>
            <Field label="IBAN"><Input value={f.iban} onChange={(e) => setF({ ...f, iban: e.target.value })} /></Field>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
            <Button variant="primary" size="sm" disabled={pending || !f.name || !f.glAccountId} onClick={() => start(async () => {
              const r = await createBankAccountAction(companyId, f);
              if (r.ok) { toast({ kind: "success", title: t("fin.accountCreated") }); setOpen(false); router.refresh(); } else toast({ kind: "error", title: r.error });
            })}>{t("common.create")}</Button>
          </div>
        </div>
      </Drawer>
    </>
  );
}

export function EditBankAccountButton({ account, accounts }: { account: { id: string; name: string; type: string; currency: string; number: string | null; glAccountId: string | null; isActive: boolean }; accounts: AccountOption[] }) {
  const router = useRouter(); const { toast } = useToast(); const { t } = useI18n();
  const [open, setOpen] = useState(false); const [pending, start] = useTransition();
  const [f, setF] = useState({ name: account.name, type: account.type, currency: account.currency, glAccountId: account.glAccountId ?? "", number: account.number ?? "" });
  return (
    <>
      <button className="text-ink-3 hover:text-ink" title={t("actions.edit")} onClick={() => setOpen(true)}><Pencil className="h-3.5 w-3.5" /></button>
      <Drawer open={open} onClose={() => setOpen(false)} title={t("fin.editAccount")} width="520px">
        <div className="space-y-3">
          <Field label={t("common.name")}><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label={t("fin.type")}><Select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}><option value="bank">{t("fin.method.bank")}</option><option value="cash">{t("fin.method.cash")}</option></Select></Field>
            <Field label={t("common.currency")}><Input value={f.currency} maxLength={3} onChange={(e) => setF({ ...f, currency: e.target.value.toUpperCase() })} /></Field>
            <Field label={t("fin.number")}><Input value={f.number} onChange={(e) => setF({ ...f, number: e.target.value })} /></Field>
          </div>
          <Field label={t("fin.glAccount")}><Select value={f.glAccountId} onChange={(e) => setF({ ...f, glAccountId: e.target.value })}>{accounts.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}</Select></Field>
          <div className="flex items-center justify-between pt-2">
            <button className="text-[12px] text-ink-3 hover:text-critical" disabled={pending} onClick={() => start(async () => {
              const r = await setBankAccountActiveAction(account.id, !account.isActive);
              if (r.ok) { toast({ kind: "success", title: account.isActive ? t("fin.deactivated") : t("fin.activated") }); setOpen(false); router.refresh(); } else toast({ kind: "error", title: r.error });
            })}>{account.isActive ? t("fin.deactivate") : t("fin.activate")}</button>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
              <Button variant="primary" size="sm" disabled={pending || !f.name} onClick={() => start(async () => {
                const r = await updateBankAccountAction(account.id, f);
                if (r.ok) { toast({ kind: "success", title: t("toast.saved") }); setOpen(false); router.refresh(); } else toast({ kind: "error", title: r.error });
              })}>{t("common.save")}</Button>
            </div>
          </div>
        </div>
      </Drawer>
    </>
  );
}

export function TransferButton({ companyId, banks }: { companyId: string; banks: Bank[] }) {
  const router = useRouter(); const { toast } = useToast(); const { t } = useI18n();
  const [open, setOpen] = useState(false); const [pending, start] = useTransition();
  const [f, setF] = useState({ fromBankAccountId: banks[0]?.id ?? "", toBankAccountId: banks[1]?.id ?? "", date: new Date().toISOString().slice(0, 10), fromAmount: "", toAmount: "", reference: "" });
  const from = banks.find((b) => b.id === f.fromBankAccountId);
  const to = banks.find((b) => b.id === f.toBankAccountId);
  const crossCurrency = from && to && from.currency !== to.currency;
  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}><ArrowLeftRight className="h-4 w-4" /> {t("fin.transfer")}</Button>
      <Drawer open={open} onClose={() => setOpen(false)} title={t("fin.bankTransfer")} description={t("fin.transferDesc")} width="500px">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("fin.from")}><Select value={f.fromBankAccountId} onChange={(e) => setF({ ...f, fromBankAccountId: e.target.value })}>{banks.map((b) => <option key={b.id} value={b.id}>{b.name} ({b.currency})</option>)}</Select></Field>
            <Field label={t("fin.to")}><Select value={f.toBankAccountId} onChange={(e) => setF({ ...f, toBankAccountId: e.target.value })}>{banks.map((b) => <option key={b.id} value={b.id}>{b.name} ({b.currency})</option>)}</Select></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("fin.amountOut", { currency: from?.currency ?? "" })}><Input value={f.fromAmount} onChange={(e) => setF({ ...f, fromAmount: e.target.value })} className="text-end tabular" /></Field>
            {crossCurrency ? <Field label={t("fin.amountIn", { currency: to?.currency ?? "" })}><Input value={f.toAmount} onChange={(e) => setF({ ...f, toAmount: e.target.value })} className="text-end tabular" /></Field> : <Field label={t("common.date")}><Input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>}
          </div>
          {crossCurrency && <Field label={t("common.date")}><Input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>}
          <Field label={t("fin.reference")}><Input value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} /></Field>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
            <Button variant="primary" size="sm" disabled={pending || !f.fromBankAccountId || !f.toBankAccountId || f.fromBankAccountId === f.toBankAccountId || !(Number(f.fromAmount) > 0)} onClick={() => start(async () => {
              const r = await createTransferAction(companyId, { fromBankAccountId: f.fromBankAccountId, toBankAccountId: f.toBankAccountId, date: f.date, fromAmount: Number(f.fromAmount), toAmount: crossCurrency && f.toAmount ? Number(f.toAmount) : undefined, reference: f.reference || undefined });
              if (r.ok) { toast({ kind: "success", title: t("fin.transferPosted", { number: r.data?.transferNumber ?? "" }) }); setOpen(false); setF({ ...f, fromAmount: "", toAmount: "", reference: "" }); router.refresh(); } else toast({ kind: "error", title: r.error });
            })}>{t("fin.postTransfer")}</Button>
          </div>
        </div>
      </Drawer>
    </>
  );
}

export function NewReconciliationButton({ companyId, banks }: { companyId: string; banks: Bank[] }) {
  const router = useRouter(); const { toast } = useToast(); const { t } = useI18n();
  const [open, setOpen] = useState(false); const [pending, start] = useTransition();
  const [f, setF] = useState({ bankAccountId: banks[0]?.id ?? "", statementDate: new Date().toISOString().slice(0, 10), statementBalance: "", note: "" });
  return (
    <>
      <Button variant="primary" size="sm" onClick={() => setOpen(true)}><ClipboardCheck className="h-4 w-4" /> {t("fin.reconcile")}</Button>
      <Drawer open={open} onClose={() => setOpen(false)} title={t("fin.newReconciliation")} description={t("fin.reconcileDesc")} width="480px">
        <div className="space-y-3">
          <Field label={t("fin.bankAccount")}><Select value={f.bankAccountId} onChange={(e) => setF({ ...f, bankAccountId: e.target.value })}>{banks.map((b) => <option key={b.id} value={b.id}>{b.name} ({b.currency})</option>)}</Select></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("fin.statementDate")}><Input type="date" value={f.statementDate} onChange={(e) => setF({ ...f, statementDate: e.target.value })} /></Field>
            <Field label={t("fin.statementBalance")}><Input value={f.statementBalance} onChange={(e) => setF({ ...f, statementBalance: e.target.value })} className="text-end tabular" /></Field>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
            <Button variant="primary" size="sm" disabled={pending || !f.bankAccountId || f.statementBalance === ""} onClick={() => start(async () => {
              const r = await createReconciliationAction(companyId, { bankAccountId: f.bankAccountId, statementDate: f.statementDate, statementBalance: Number(f.statementBalance), note: f.note || undefined });
              if (r.ok && r.data) { toast({ kind: "success", title: t("fin.reconciliationStarted") }); setOpen(false); router.push(`/accounting/bank/reconcile/${r.data.id}`); } else if (!r.ok) toast({ kind: "error", title: r.error });
            })}>{t("fin.start")}</Button>
          </div>
        </div>
      </Drawer>
    </>
  );
}

export function ReconcileLineToggle({ reconciliationId, journalLineId, cleared, disabled }: { reconciliationId: string; journalLineId: string; cleared: boolean; disabled?: boolean }) {
  const router = useRouter(); const { toast } = useToast(); const { t } = useI18n();
  const [pending, start] = useTransition();
  return (
    <button disabled={pending || disabled} className={`flex h-5 w-5 items-center justify-center rounded border ${cleared ? "border-success bg-success/15 text-success" : "border-line text-transparent hover:border-ink-3"}`}
      onClick={() => start(async () => {
        const r = await setLineReconciledAction(reconciliationId, journalLineId, !cleared);
        if (r.ok) router.refresh(); else toast({ kind: "error", title: r.error });
      })}><Check className="h-3.5 w-3.5" /></button>
  );
}

export function CompleteReconciliationButton({ id, balanced }: { id: string; balanced: boolean }) {
  const router = useRouter(); const { toast } = useToast(); const { t } = useI18n();
  const [pending, start] = useTransition();
  return (
    <Button variant="primary" size="sm" disabled={pending} onClick={() => start(async () => {
      const force = !balanced ? window.confirm(t("fin.reconcileConfirm")) : false;
      if (!balanced && !force) return;
      const r = await completeReconciliationAction(id, force);
      if (r.ok) { toast({ kind: "success", title: t("fin.reconciliationCompleted") }); router.refresh(); } else toast({ kind: "error", title: r.error });
    })}><ClipboardCheck className="h-4 w-4" /> {t("fin.complete")}</Button>
  );
}
