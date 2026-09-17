"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Pencil, Send, Ban, Wallet, Link2 } from "lucide-react";
import { Button, Input, Select, Drawer } from "@/components/ui";
import { useToast, useI18n } from "@/components/providers";
import { createSupplierAction, updateSupplierAction, setSupplierActiveAction } from "@/app/actions/ap";
import { createBillAction, postBillAction, voidBillAction, createSupplierCreditAction, postSupplierCreditAction, applySupplierCreditAction, postPaymentAction } from "@/app/actions/ap";
import { postExpenseAction } from "@/app/actions/ap";

type Option = { id: string; name?: string };
type TaxOption = { id: string; name: string; rate: number };
type AccountOption = { id: string; label: string };

function fmt(n: number, min = 2) { return n.toLocaleString(undefined, { minimumFractionDigits: min, maximumFractionDigits: 3 }); }
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1 block text-[12px] text-ink-2">{label}</span>{children}</label>;
}

// ---------------------------------------------------------------------------
// Suppliers
// ---------------------------------------------------------------------------
const emptySupplier = { name: "", code: "", email: "", phone: "", currency: "", taxId: "", paymentTermsDays: "" };

export function NewSupplierButton({ companyId }: { companyId: string }) {
  const router = useRouter(); const { toast } = useToast(); const { t } = useI18n();
  const [open, setOpen] = useState(false); const [pending, start] = useTransition();
  const [f, setF] = useState({ ...emptySupplier });
  return (
    <>
      <Button variant="primary" size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> {t("fin.newSupplier")}</Button>
      <Drawer open={open} onClose={() => setOpen(false)} title={t("fin.newSupplier")} width="520px">
        <div className="space-y-3">
          <Field label={t("common.name")}><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("common.code")}><Input value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} /></Field>
            <Field label={t("common.currency")}><Input value={f.currency} maxLength={3} placeholder="KWD" onChange={(e) => setF({ ...f, currency: e.target.value.toUpperCase() })} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("common.email")}><Input value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
            <Field label={t("common.phone")}><Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("fin.taxId")}><Input value={f.taxId} onChange={(e) => setF({ ...f, taxId: e.target.value })} /></Field>
            <Field label={t("fin.paymentTermsDays")}><Input type="number" value={f.paymentTermsDays} onChange={(e) => setF({ ...f, paymentTermsDays: e.target.value })} /></Field>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
            <Button variant="primary" size="sm" disabled={pending || !f.name} onClick={() => start(async () => {
              const r = await createSupplierAction(companyId, { ...f, paymentTermsDays: f.paymentTermsDays || undefined, currency: f.currency || undefined });
              if (r.ok) { toast({ kind: "success", title: t("fin.supplierCreated") }); setOpen(false); setF({ ...emptySupplier }); router.refresh(); } else toast({ kind: "error", title: r.error });
            })}>{t("common.create")}</Button>
          </div>
        </div>
      </Drawer>
    </>
  );
}

export function EditSupplierButton({ supplier }: { supplier: { id: string; name: string; code: string | null; email: string | null; phone: string | null; currency: string | null; taxId: string | null; paymentTermsDays: number | null; isActive: boolean } }) {
  const router = useRouter(); const { toast } = useToast(); const { t } = useI18n();
  const [open, setOpen] = useState(false); const [pending, start] = useTransition();
  const [f, setF] = useState({ name: supplier.name, code: supplier.code ?? "", email: supplier.email ?? "", phone: supplier.phone ?? "", currency: supplier.currency ?? "", taxId: supplier.taxId ?? "", paymentTermsDays: supplier.paymentTermsDays?.toString() ?? "" });
  return (
    <>
      <button className="text-ink-3 hover:text-ink" title={t("actions.edit")} onClick={() => setOpen(true)}><Pencil className="h-3.5 w-3.5" /></button>
      <Drawer open={open} onClose={() => setOpen(false)} title={t("fin.editSupplier")} width="520px">
        <div className="space-y-3">
          <Field label={t("common.name")}><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("common.code")}><Input value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} /></Field>
            <Field label={t("common.currency")}><Input value={f.currency} maxLength={3} onChange={(e) => setF({ ...f, currency: e.target.value.toUpperCase() })} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("common.email")}><Input value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
            <Field label={t("common.phone")}><Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("fin.taxId")}><Input value={f.taxId} onChange={(e) => setF({ ...f, taxId: e.target.value })} /></Field>
            <Field label={t("fin.paymentTermsDays")}><Input type="number" value={f.paymentTermsDays} onChange={(e) => setF({ ...f, paymentTermsDays: e.target.value })} /></Field>
          </div>
          <div className="flex items-center justify-between pt-2">
            <button className="text-[12px] text-ink-3 hover:text-critical" disabled={pending} onClick={() => start(async () => {
              const r = await setSupplierActiveAction(supplier.id, !supplier.isActive);
              if (r.ok) { toast({ kind: "success", title: supplier.isActive ? t("fin.deactivated") : t("fin.activated") }); setOpen(false); router.refresh(); } else toast({ kind: "error", title: r.error });
            })}>{supplier.isActive ? t("fin.deactivate") : t("fin.activate")}</button>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
              <Button variant="primary" size="sm" disabled={pending || !f.name} onClick={() => start(async () => {
                const r = await updateSupplierAction(supplier.id, { ...f, paymentTermsDays: f.paymentTermsDays || undefined, currency: f.currency || undefined });
                if (r.ok) { toast({ kind: "success", title: t("toast.saved") }); setOpen(false); router.refresh(); } else toast({ kind: "error", title: r.error });
              })}>{t("common.save")}</Button>
            </div>
          </div>
        </div>
      </Drawer>
    </>
  );
}

// ---------------------------------------------------------------------------
// Bill / supplier-credit composer (line editor with GL account per line)
// ---------------------------------------------------------------------------
type LineDraft = { description: string; quantity: string; unitPrice: string; discountPct: string; taxRateId: string; expenseAccountId: string };

export function BillComposer({ companyId, kind, suppliers, taxRates, accounts, baseCurrency }: { companyId: string; kind: "bill" | "credit"; suppliers: Option[]; taxRates: TaxOption[]; accounts: AccountOption[]; baseCurrency: string }) {
  const router = useRouter(); const { toast } = useToast(); const { t } = useI18n();
  const [pending, start] = useTransition();
  const defaultAccount = accounts[0]?.id ?? "";
  const blankLine: LineDraft = { description: "", quantity: "1", unitPrice: "0", discountPct: "0", taxRateId: "", expenseAccountId: defaultAccount };
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id ?? "");
  const [supplierRef, setSupplierRef] = useState("");
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState("");
  const [lines, setLines] = useState<LineDraft[]>([{ ...blankLine }]);

  const taxRateOf = (id: string) => taxRates.find((tr) => tr.id === id)?.rate ?? 0;
  const totals = useMemo(() => {
    let net = 0, tax = 0;
    for (const l of lines) { const n = (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0) * (1 - (Number(l.discountPct) || 0) / 100); net += n; tax += n * (taxRateOf(l.taxRateId) / 100); }
    return { net, tax, total: net + tax };
  }, [lines]); // eslint-disable-line react-hooks/exhaustive-deps

  const setLine = (i: number, patch: Partial<LineDraft>) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const validLines = lines.filter((l) => l.description.trim() && l.expenseAccountId && Number(l.unitPrice) !== 0);

  const submit = (post: boolean) => start(async () => {
    const payload = {
      supplierId, supplierRef: supplierRef || undefined, issueDate, reason: reason || undefined,
      lines: validLines.map((l) => ({ description: l.description, quantity: Number(l.quantity) || 0, unitPrice: Number(l.unitPrice) || 0, discountPct: Number(l.discountPct) || 0, taxRateId: l.taxRateId || undefined, expenseAccountId: l.expenseAccountId })),
    };
    const created = kind === "bill" ? await createBillAction(companyId, payload) : await createSupplierCreditAction(companyId, payload);
    if (!created.ok || !created.data) { toast({ kind: "error", title: created.ok ? t("fin.couldNotCreateShort") : created.error }); return; }
    const id = created.data.id;
    if (post) {
      const posted = kind === "bill" ? await postBillAction(id) : await postSupplierCreditAction(id);
      if (!posted.ok) { toast({ kind: "error", title: t("fin.savedDraftNotPosted", { error: posted.error }) }); router.push(`/accounting/${kind === "bill" ? "bills" : "supplier-credits"}/${id}`); return; }
    }
    toast({ kind: "success", title: post ? t("fin.posted") : t("fin.savedAsDraft") });
    router.push(`/accounting/${kind === "bill" ? "bills" : "supplier-credits"}/${id}`);
  });

  const postLabel = kind === "bill" ? t("fin.postBill") : t("fin.postSupplierCredit");
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label={t("fin.supplier")}><Select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>{suppliers.length === 0 && <option value="">{t("fin.noSuppliers")}</option>}{suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
        <Field label={kind === "bill" ? t("fin.supplierInvoiceNum") : t("fin.reference")}><Input value={supplierRef} onChange={(e) => setSupplierRef(e.target.value)} /></Field>
        <Field label={t("common.date")}><Input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} /></Field>
      </div>
      {kind === "credit" && <Field label={t("fin.reason")}><Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t("fin.phReasonCredit")} /></Field>}

      <div className="overflow-x-auto rounded-lg border border-line">
        <table className="w-full min-w-[820px] text-[13px]">
          <thead><tr className="border-b border-line bg-surface-2 text-[11px] uppercase tracking-wide text-ink-3">
            <th className="px-2 py-2 text-start font-medium">{t("common.description")}</th>
            <th className="w-40 px-2 py-2 text-start font-medium">{t("fin.account")}</th>
            <th className="w-16 px-2 py-2 text-end font-medium">{t("fin.qty")}</th>
            <th className="w-24 px-2 py-2 text-end font-medium">{t("fin.unitPrice")}</th>
            <th className="w-28 px-2 py-2 text-start font-medium">{t("fin.tax")}</th>
            <th className="w-24 px-2 py-2 text-end font-medium">{t("fin.lineTotal")}</th>
            <th className="w-8 px-2 py-2"></th>
          </tr></thead>
          <tbody>
            {lines.map((l, i) => {
              const n = (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0) * (1 - (Number(l.discountPct) || 0) / 100);
              return (
                <tr key={i} className="border-b border-line last:border-0">
                  <td className="px-2 py-1.5"><Input value={l.description} onChange={(e) => setLine(i, { description: e.target.value })} className="h-8" /></td>
                  <td className="px-2 py-1.5"><Select value={l.expenseAccountId} onChange={(e) => setLine(i, { expenseAccountId: e.target.value })} className="h-8">{accounts.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}</Select></td>
                  <td className="px-2 py-1.5"><Input value={l.quantity} onChange={(e) => setLine(i, { quantity: e.target.value })} className="h-8 text-end tabular" /></td>
                  <td className="px-2 py-1.5"><Input value={l.unitPrice} onChange={(e) => setLine(i, { unitPrice: e.target.value })} className="h-8 text-end tabular" /></td>
                  <td className="px-2 py-1.5"><Select value={l.taxRateId} onChange={(e) => setLine(i, { taxRateId: e.target.value })} className="h-8"><option value="">{t("fin.none")}</option>{taxRates.map((tr) => <option key={tr.id} value={tr.id}>{tr.name}</option>)}</Select></td>
                  <td className="px-2 py-1.5 text-end tabular text-ink-2">{fmt(n)}</td>
                  <td className="px-2 py-1.5 text-center">{lines.length > 1 && <button className="text-ink-3 hover:text-critical" onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}><Trash2 className="h-3.5 w-3.5" /></button>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => setLines((ls) => [...ls, { ...blankLine }])}><Plus className="h-4 w-4" /> {t("fin.addLine")}</Button>
        <div className="space-y-0.5 text-end text-[13px]">
          <div className="flex justify-between gap-8"><span className="text-ink-3">{t("fin.subtotal")}</span><span className="tabular text-ink-2">{fmt(totals.net)} {baseCurrency}</span></div>
          <div className="flex justify-between gap-8"><span className="text-ink-3">{t("fin.tax")}</span><span className="tabular text-ink-2">{fmt(totals.tax)} {baseCurrency}</span></div>
          <div className="flex justify-between gap-8 border-t border-line pt-1 font-semibold"><span>{t("common.total")}</span><span className="tabular text-ink">{fmt(totals.total)} {baseCurrency}</span></div>
        </div>
      </div>
      <div className="flex justify-end gap-2 border-t border-line pt-3">
        <Button variant="secondary" size="sm" disabled={pending || !supplierId || validLines.length === 0} onClick={() => submit(false)}>{t("fin.saveDraft")}</Button>
        <Button variant="primary" size="sm" disabled={pending || !supplierId || validLines.length === 0} onClick={() => submit(true)}><Send className="h-4 w-4" /> {postLabel}</Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
export function PostBillButton({ id, kind }: { id: string; kind: "bill" | "credit" }) {
  const router = useRouter(); const { toast } = useToast(); const { t } = useI18n();
  const [pending, start] = useTransition();
  return (
    <Button variant="primary" size="sm" disabled={pending} onClick={() => start(async () => {
      const r = kind === "bill" ? await postBillAction(id) : await postSupplierCreditAction(id);
      if (r.ok) { toast({ kind: "success", title: t("fin.posted") }); router.refresh(); } else toast({ kind: "error", title: r.error });
    })}><Send className="h-4 w-4" /> {t("fin.post")}</Button>
  );
}

export function VoidBillButton({ id }: { id: string }) {
  const router = useRouter(); const { toast } = useToast(); const { t } = useI18n();
  const [pending, start] = useTransition();
  return (
    <Button variant="ghost" size="sm" disabled={pending} onClick={() => start(async () => {
      const reason = window.prompt(t("fin.voidBillPrompt")); if (!reason) return;
      const r = await voidBillAction(id, reason);
      if (r.ok) { toast({ kind: "success", title: t("fin.billVoided") }); router.refresh(); } else toast({ kind: "error", title: r.error });
    })}><Ban className="h-3.5 w-3.5" /> {t("fin.void")}</Button>
  );
}

export function ApplySupplierCreditButton({ creditId, remaining, currency, openBills }: { creditId: string; remaining: number; currency: string; openBills: { id: string; billNumber: string | null; amountDue: number }[] }) {
  const router = useRouter(); const { toast } = useToast(); const { t } = useI18n();
  const [open, setOpen] = useState(false); const [pending, start] = useTransition();
  const [alloc, setAlloc] = useState<Record<string, string>>({});
  const sum = Object.values(alloc).reduce((s, v) => s + (Number(v) || 0), 0);
  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}><Link2 className="h-4 w-4" /> {t("fin.apply")}</Button>
      <Drawer open={open} onClose={() => setOpen(false)} title={t("fin.applySupplierCredit")} description={t("fin.remaining", { amount: fmt(remaining), currency })} width="480px">
        <div className="space-y-2">
          {openBills.length === 0 && <p className="text-[13px] text-ink-3">{t("fin.noOpenBills")}</p>}
          {openBills.map((b) => (
            <div key={b.id} className="flex items-center justify-between gap-3">
              <span className="text-[13px] text-ink-2">{b.billNumber} · {t("fin.due")} {fmt(b.amountDue)}</span>
              <Input className="h-8 w-28 text-end tabular" placeholder="0" value={alloc[b.id] ?? ""} onChange={(e) => setAlloc({ ...alloc, [b.id]: e.target.value })} />
            </div>
          ))}
          <div className="flex items-center justify-between border-t border-line pt-2 text-[13px]"><span className="text-ink-3">{t("fin.applying")}</span><span className={`tabular ${sum > remaining ? "text-critical" : "text-ink"}`}>{fmt(sum)} {currency}</span></div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
            <Button variant="primary" size="sm" disabled={pending || sum <= 0 || sum > remaining} onClick={() => start(async () => {
              const allocations = Object.entries(alloc).filter(([, v]) => Number(v) > 0).map(([billId, v]) => ({ billId, amount: Number(v) }));
              const r = await applySupplierCreditAction(creditId, allocations);
              if (r.ok) { toast({ kind: "success", title: t("fin.applied") }); setOpen(false); router.refresh(); } else toast({ kind: "error", title: r.error });
            })}>{t("fin.apply")}</Button>
          </div>
        </div>
      </Drawer>
    </>
  );
}

export function RecordPaymentButton({ companyId, baseCurrency, suppliers, openBills }: { companyId: string; baseCurrency: string; suppliers: Option[]; openBills: { id: string; billNumber: string | null; supplierId: string; amountDue: number }[] }) {
  const router = useRouter(); const { toast } = useToast(); const { t } = useI18n();
  const [open, setOpen] = useState(false); const [pending, start] = useTransition();
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id ?? "");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("bank");
  const [reference, setReference] = useState("");
  const [alloc, setAlloc] = useState<Record<string, string>>({});

  const supBills = openBills.filter((b) => b.supplierId === supplierId);
  const allocSum = Object.entries(alloc).filter(([id]) => supBills.some((b) => b.id === id)).reduce((s, [, v]) => s + (Number(v) || 0), 0);
  const amt = Number(amount) || 0;
  const reset = () => { setAmount(""); setAlloc({}); setReference(""); };
  return (
    <>
      <Button variant="primary" size="sm" onClick={() => setOpen(true)}><Wallet className="h-4 w-4" /> {t("fin.recordPayment")}</Button>
      <Drawer open={open} onClose={() => setOpen(false)} title={t("fin.recordSupplierPayment")} description={t("fin.drPayableCrBank")} width="520px">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("fin.supplier")}><Select value={supplierId} onChange={(e) => { setSupplierId(e.target.value); setAlloc({}); }}>{suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
            <Field label={t("common.date")}><Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} /></Field>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label={t("fin.amountCur", { currency: baseCurrency })}><Input value={amount} onChange={(e) => setAmount(e.target.value)} className="text-end tabular" placeholder="0.000" /></Field>
            <Field label={t("fin.method")}><Select value={method} onChange={(e) => setMethod(e.target.value)}>{["bank", "cash", "card", "cheque", "transfer"].map((m) => <option key={m} value={m}>{t(`fin.method.${m}`)}</option>)}</Select></Field>
            <Field label={t("fin.reference")}><Input value={reference} onChange={(e) => setReference(e.target.value)} /></Field>
          </div>
          <div className="rounded-lg border border-line">
            <div className="border-b border-line px-3 py-1.5 text-[11px] uppercase tracking-wide text-ink-3">{t("fin.allocateOpenBills")}</div>
            <div className="space-y-1.5 p-2">
              {supBills.length === 0 && <p className="px-1 text-[13px] text-ink-3">{t("fin.noOpenBillsUnapplied")}</p>}
              {supBills.map((b) => (
                <div key={b.id} className="flex items-center justify-between gap-3">
                  <span className="text-[13px] text-ink-2">{b.billNumber} · {t("fin.due")} {fmt(b.amountDue)}</span>
                  <div className="flex items-center gap-1">
                    <Input className="h-8 w-28 text-end tabular" placeholder="0" value={alloc[b.id] ?? ""} onChange={(e) => setAlloc({ ...alloc, [b.id]: e.target.value })} />
                    <button className="text-[11px] text-accent hover:underline" onClick={() => setAlloc({ ...alloc, [b.id]: String(b.amountDue) })}>{t("fin.max")}</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="text-[13px] text-ink-3">{t("fin.allocatedUnapplied", { allocated: fmt(allocSum), unapplied: fmt(Math.max(0, amt - allocSum)) })}</div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
            <Button variant="primary" size="sm" disabled={pending || amt <= 0 || allocSum > amt} onClick={() => start(async () => {
              const allocations = Object.entries(alloc).filter(([id, v]) => Number(v) > 0 && supBills.some((b) => b.id === id)).map(([billId, v]) => ({ billId, amount: Number(v) }));
              const r = await postPaymentAction(companyId, { supplierId, paymentDate, amount: amt, method, reference: reference || undefined, allocations });
              if (r.ok) { toast({ kind: "success", title: t("fin.paymentPosted", { number: r.data?.paymentNumber ?? "" }) }); setOpen(false); reset(); router.refresh(); } else toast({ kind: "error", title: r.error });
            })}>{t("fin.postPayment")}</Button>
          </div>
        </div>
      </Drawer>
    </>
  );
}

// ---------------------------------------------------------------------------
export function PostExpenseButton({ expenseId }: { expenseId: string }) {
  const router = useRouter(); const { toast } = useToast(); const { t } = useI18n();
  const [pending, start] = useTransition();
  return (
    <Button variant="secondary" size="sm" disabled={pending} onClick={() => start(async () => {
      const r = await postExpenseAction(expenseId);
      if (r.ok) { toast({ kind: "success", title: t("fin.expensePosted") }); router.refresh(); } else toast({ kind: "error", title: r.error });
    })}><Send className="h-3.5 w-3.5" /> {t("fin.postToLedger")}</Button>
  );
}
