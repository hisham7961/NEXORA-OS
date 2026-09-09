"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Pencil, Send, Ban, HandCoins, Link2 } from "lucide-react";
import { Button, Input, Select, Drawer } from "@/components/ui";
import { useToast } from "@/components/providers";
import { createCustomerAction, updateCustomerAction, setCustomerActiveAction } from "@/app/actions/ar";
import { createInvoiceAction, issueInvoiceAction, voidInvoiceAction, createCreditNoteAction, issueCreditNoteAction, applyCreditNoteAction, postReceiptAction } from "@/app/actions/ar";

type Option = { id: string; name?: string; code?: string };
type TaxOption = { id: string; name: string; rate: number };

function fmt(n: number, min = 2) { return n.toLocaleString(undefined, { minimumFractionDigits: min, maximumFractionDigits: 3 }); }

// ---------------------------------------------------------------------------
// Customers
// ---------------------------------------------------------------------------
const emptyCustomer = { name: "", code: "", email: "", phone: "", currency: "", taxId: "", paymentTermsDays: "", notes: "" };

export function NewCustomerButton({ companyId }: { companyId: string }) {
  const router = useRouter(); const { toast } = useToast();
  const [open, setOpen] = useState(false); const [pending, start] = useTransition();
  const [f, setF] = useState({ ...emptyCustomer });
  return (
    <>
      <Button variant="primary" size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> New customer</Button>
      <Drawer open={open} onClose={() => setOpen(false)} title="New customer" width="520px">
        <div className="space-y-3">
          <Field label="Name"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Code"><Input value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} /></Field>
            <Field label="Currency"><Input value={f.currency} maxLength={3} placeholder="KWD" onChange={(e) => setF({ ...f, currency: e.target.value.toUpperCase() })} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Email"><Input value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
            <Field label="Phone"><Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Tax ID"><Input value={f.taxId} onChange={(e) => setF({ ...f, taxId: e.target.value })} /></Field>
            <Field label="Payment terms (days)"><Input type="number" value={f.paymentTermsDays} onChange={(e) => setF({ ...f, paymentTermsDays: e.target.value })} /></Field>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="primary" size="sm" disabled={pending || !f.name} onClick={() => start(async () => {
              const r = await createCustomerAction(companyId, { ...f, paymentTermsDays: f.paymentTermsDays || undefined, currency: f.currency || undefined });
              if (r.ok) { toast({ kind: "success", title: "Customer created" }); setOpen(false); setF({ ...emptyCustomer }); router.refresh(); } else toast({ kind: "error", title: r.error });
            })}>Create</Button>
          </div>
        </div>
      </Drawer>
    </>
  );
}

export function EditCustomerButton({ customer }: { customer: { id: string; name: string; code: string | null; email: string | null; phone: string | null; currency: string | null; taxId: string | null; paymentTermsDays: number | null; isActive: boolean } }) {
  const router = useRouter(); const { toast } = useToast();
  const [open, setOpen] = useState(false); const [pending, start] = useTransition();
  const [f, setF] = useState({ name: customer.name, code: customer.code ?? "", email: customer.email ?? "", phone: customer.phone ?? "", currency: customer.currency ?? "", taxId: customer.taxId ?? "", paymentTermsDays: customer.paymentTermsDays?.toString() ?? "" });
  return (
    <>
      <button className="text-ink-3 hover:text-ink" title="Edit" onClick={() => setOpen(true)}><Pencil className="h-3.5 w-3.5" /></button>
      <Drawer open={open} onClose={() => setOpen(false)} title="Edit customer" width="520px">
        <div className="space-y-3">
          <Field label="Name"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Code"><Input value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} /></Field>
            <Field label="Currency"><Input value={f.currency} maxLength={3} onChange={(e) => setF({ ...f, currency: e.target.value.toUpperCase() })} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Email"><Input value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
            <Field label="Phone"><Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Tax ID"><Input value={f.taxId} onChange={(e) => setF({ ...f, taxId: e.target.value })} /></Field>
            <Field label="Payment terms (days)"><Input type="number" value={f.paymentTermsDays} onChange={(e) => setF({ ...f, paymentTermsDays: e.target.value })} /></Field>
          </div>
          <div className="flex items-center justify-between pt-2">
            <button className="text-[12px] text-ink-3 hover:text-critical" disabled={pending} onClick={() => start(async () => {
              const r = await setCustomerActiveAction(customer.id, !customer.isActive);
              if (r.ok) { toast({ kind: "success", title: customer.isActive ? "Deactivated" : "Activated" }); setOpen(false); router.refresh(); } else toast({ kind: "error", title: r.error });
            })}>{customer.isActive ? "Deactivate" : "Activate"}</button>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
              <Button variant="primary" size="sm" disabled={pending || !f.name} onClick={() => start(async () => {
                const r = await updateCustomerAction(customer.id, { ...f, paymentTermsDays: f.paymentTermsDays || undefined, currency: f.currency || undefined });
                if (r.ok) { toast({ kind: "success", title: "Saved" }); setOpen(false); router.refresh(); } else toast({ kind: "error", title: r.error });
              })}>Save</Button>
            </div>
          </div>
        </div>
      </Drawer>
    </>
  );
}

// ---------------------------------------------------------------------------
// Invoice / Credit note composer (shared line editor)
// ---------------------------------------------------------------------------
type LineDraft = { description: string; quantity: string; unitPrice: string; discountPct: string; taxRateId: string };
const blankLine: LineDraft = { description: "", quantity: "1", unitPrice: "0", discountPct: "0", taxRateId: "" };

export function DocumentComposer({ companyId, kind, customers, taxRates, baseCurrency }: { companyId: string; kind: "invoice" | "credit_note"; customers: Option[]; taxRates: TaxOption[]; baseCurrency: string }) {
  const router = useRouter(); const { toast } = useToast();
  const [pending, start] = useTransition();
  const [customerId, setCustomerId] = useState(customers[0]?.id ?? "");
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10));
  const [reference, setReference] = useState("");
  const [reason, setReason] = useState("");
  const [lines, setLines] = useState<LineDraft[]>([{ ...blankLine }]);

  const taxRateOf = (id: string) => taxRates.find((t) => t.id === id)?.rate ?? 0;
  const totals = useMemo(() => {
    let net = 0, tax = 0;
    for (const l of lines) {
      const lineNet = (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0) * (1 - (Number(l.discountPct) || 0) / 100);
      net += lineNet; tax += lineNet * (taxRateOf(l.taxRateId) / 100);
    }
    return { net, tax, total: net + tax };
  }, [lines]); // eslint-disable-line react-hooks/exhaustive-deps

  const setLine = (i: number, patch: Partial<LineDraft>) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const validLines = lines.filter((l) => l.description.trim() && Number(l.unitPrice) !== 0);

  const submit = (issue: boolean) => start(async () => {
    const payload = {
      customerId, issueDate, reference: reference || undefined, reason: reason || undefined,
      lines: validLines.map((l) => ({ description: l.description, quantity: Number(l.quantity) || 0, unitPrice: Number(l.unitPrice) || 0, discountPct: Number(l.discountPct) || 0, taxRateId: l.taxRateId || undefined })),
    };
    const created = kind === "invoice" ? await createInvoiceAction(companyId, payload) : await createCreditNoteAction(companyId, payload);
    if (!created.ok || !created.data) { toast({ kind: "error", title: created.ok ? "Could not create document" : created.error }); return; }
    const id = created.data.id;
    if (issue) {
      const issued = kind === "invoice" ? await issueInvoiceAction(id) : await issueCreditNoteAction(id);
      if (!issued.ok) { toast({ kind: "error", title: `Saved as draft, but could not issue: ${issued.error}` }); router.push(`/accounting/${kind === "invoice" ? "invoices" : "credit-notes"}/${id}`); return; }
    }
    toast({ kind: "success", title: issue ? "Issued" : "Saved as draft" });
    router.push(`/accounting/${kind === "invoice" ? "invoices" : "credit-notes"}/${id}`);
  });

  const label = kind === "invoice" ? "invoice" : "credit note";
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label="Customer"><Select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>{customers.length === 0 && <option value="">No customers</option>}{customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
        <Field label="Issue date"><Input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} /></Field>
        <Field label="Reference"><Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="PO / note" /></Field>
      </div>
      {kind === "credit_note" && <Field label="Reason"><Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason for credit" /></Field>}

      <div className="overflow-x-auto rounded-lg border border-line">
        <table className="w-full min-w-[720px] text-[13px]">
          <thead><tr className="border-b border-line bg-surface-2 text-start text-[11px] uppercase tracking-wide text-ink-3">
            <th className="px-2 py-2 text-start font-medium">Description</th>
            <th className="w-20 px-2 py-2 text-end font-medium">Qty</th>
            <th className="w-28 px-2 py-2 text-end font-medium">Unit price</th>
            <th className="w-20 px-2 py-2 text-end font-medium">Disc %</th>
            <th className="w-32 px-2 py-2 text-start font-medium">Tax</th>
            <th className="w-28 px-2 py-2 text-end font-medium">Line total</th>
            <th className="w-8 px-2 py-2"></th>
          </tr></thead>
          <tbody>
            {lines.map((l, i) => {
              const lineNet = (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0) * (1 - (Number(l.discountPct) || 0) / 100);
              return (
                <tr key={i} className="border-b border-line last:border-0">
                  <td className="px-2 py-1.5"><Input value={l.description} onChange={(e) => setLine(i, { description: e.target.value })} placeholder="Item / service" className="h-8" /></td>
                  <td className="px-2 py-1.5"><Input value={l.quantity} onChange={(e) => setLine(i, { quantity: e.target.value })} className="h-8 text-end tabular" /></td>
                  <td className="px-2 py-1.5"><Input value={l.unitPrice} onChange={(e) => setLine(i, { unitPrice: e.target.value })} className="h-8 text-end tabular" /></td>
                  <td className="px-2 py-1.5"><Input value={l.discountPct} onChange={(e) => setLine(i, { discountPct: e.target.value })} className="h-8 text-end tabular" /></td>
                  <td className="px-2 py-1.5"><Select value={l.taxRateId} onChange={(e) => setLine(i, { taxRateId: e.target.value })} className="h-8"><option value="">None</option>{taxRates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</Select></td>
                  <td className="px-2 py-1.5 text-end tabular text-ink-2">{fmt(lineNet)}</td>
                  <td className="px-2 py-1.5 text-center">{lines.length > 1 && <button className="text-ink-3 hover:text-critical" onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}><Trash2 className="h-3.5 w-3.5" /></button>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => setLines((ls) => [...ls, { ...blankLine }])}><Plus className="h-4 w-4" /> Add line</Button>
        <div className="space-y-0.5 text-end text-[13px]">
          <div className="flex justify-between gap-8"><span className="text-ink-3">Subtotal</span><span className="tabular text-ink-2">{fmt(totals.net)} {baseCurrency}</span></div>
          <div className="flex justify-between gap-8"><span className="text-ink-3">Tax</span><span className="tabular text-ink-2">{fmt(totals.tax)} {baseCurrency}</span></div>
          <div className="flex justify-between gap-8 border-t border-line pt-1 font-semibold"><span>Total</span><span className="tabular text-ink">{fmt(totals.total)} {baseCurrency}</span></div>
        </div>
      </div>
      <div className="flex justify-end gap-2 border-t border-line pt-3">
        <Button variant="secondary" size="sm" disabled={pending || !customerId || validLines.length === 0} onClick={() => submit(false)}>Save draft</Button>
        <Button variant="primary" size="sm" disabled={pending || !customerId || validLines.length === 0} onClick={() => submit(true)}><Send className="h-4 w-4" /> Issue {label}</Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Document actions
// ---------------------------------------------------------------------------
export function IssueButton({ id, kind }: { id: string; kind: "invoice" | "credit_note" }) {
  const router = useRouter(); const { toast } = useToast();
  const [pending, start] = useTransition();
  return (
    <Button variant="primary" size="sm" disabled={pending} onClick={() => start(async () => {
      const r = kind === "invoice" ? await issueInvoiceAction(id) : await issueCreditNoteAction(id);
      if (r.ok) { toast({ kind: "success", title: "Issued" }); router.refresh(); } else toast({ kind: "error", title: r.error });
    })}><Send className="h-4 w-4" /> Issue</Button>
  );
}

export function VoidInvoiceButton({ id }: { id: string }) {
  const router = useRouter(); const { toast } = useToast();
  const [pending, start] = useTransition();
  return (
    <Button variant="ghost" size="sm" disabled={pending} onClick={() => start(async () => {
      const reason = window.prompt("Reason for voiding this invoice?"); if (!reason) return;
      const r = await voidInvoiceAction(id, reason);
      if (r.ok) { toast({ kind: "success", title: "Invoice voided" }); router.refresh(); } else toast({ kind: "error", title: r.error });
    })}><Ban className="h-3.5 w-3.5" /> Void</Button>
  );
}

// ---------------------------------------------------------------------------
// Apply credit note to open invoices
// ---------------------------------------------------------------------------
export function ApplyCreditNoteButton({ creditNoteId, remaining, currency, openInvoices }: { creditNoteId: string; remaining: number; currency: string; openInvoices: { id: string; invoiceNumber: string | null; amountDue: number }[] }) {
  const router = useRouter(); const { toast } = useToast();
  const [open, setOpen] = useState(false); const [pending, start] = useTransition();
  const [alloc, setAlloc] = useState<Record<string, string>>({});
  const sum = Object.values(alloc).reduce((s, v) => s + (Number(v) || 0), 0);
  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}><Link2 className="h-4 w-4" /> Apply</Button>
      <Drawer open={open} onClose={() => setOpen(false)} title="Apply credit note" description={`Remaining ${fmt(remaining)} ${currency}`} width="480px">
        <div className="space-y-2">
          {openInvoices.length === 0 && <p className="text-[13px] text-ink-3">No open invoices for this customer.</p>}
          {openInvoices.map((inv) => (
            <div key={inv.id} className="flex items-center justify-between gap-3">
              <span className="text-[13px] text-ink-2">{inv.invoiceNumber} · due {fmt(inv.amountDue)}</span>
              <Input className="h-8 w-28 text-end tabular" placeholder="0" value={alloc[inv.id] ?? ""} onChange={(e) => setAlloc({ ...alloc, [inv.id]: e.target.value })} />
            </div>
          ))}
          <div className="flex items-center justify-between border-t border-line pt-2 text-[13px]"><span className="text-ink-3">Applying</span><span className={`tabular ${sum > remaining ? "text-critical" : "text-ink"}`}>{fmt(sum)} {currency}</span></div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="primary" size="sm" disabled={pending || sum <= 0 || sum > remaining} onClick={() => start(async () => {
              const allocations = Object.entries(alloc).filter(([, v]) => Number(v) > 0).map(([invoiceId, v]) => ({ invoiceId, amount: Number(v) }));
              const r = await applyCreditNoteAction(creditNoteId, allocations);
              if (r.ok) { toast({ kind: "success", title: "Applied" }); setOpen(false); router.refresh(); } else toast({ kind: "error", title: r.error });
            })}>Apply</Button>
          </div>
        </div>
      </Drawer>
    </>
  );
}

// ---------------------------------------------------------------------------
// Record a customer receipt
// ---------------------------------------------------------------------------
export function RecordReceiptButton({ companyId, baseCurrency, customers, openInvoices }: { companyId: string; baseCurrency: string; customers: Option[]; openInvoices: { id: string; invoiceNumber: string | null; customerId: string; amountDue: number }[] }) {
  const router = useRouter(); const { toast } = useToast();
  const [open, setOpen] = useState(false); const [pending, start] = useTransition();
  const [customerId, setCustomerId] = useState(customers[0]?.id ?? "");
  const [receiptDate, setReceiptDate] = useState(new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("bank");
  const [reference, setReference] = useState("");
  const [alloc, setAlloc] = useState<Record<string, string>>({});

  const custInvoices = openInvoices.filter((i) => i.customerId === customerId);
  const allocSum = Object.entries(alloc).filter(([id]) => custInvoices.some((i) => i.id === id)).reduce((s, [, v]) => s + (Number(v) || 0), 0);
  const amt = Number(amount) || 0;

  const reset = () => { setAmount(""); setAlloc({}); setReference(""); };
  return (
    <>
      <Button variant="primary" size="sm" onClick={() => setOpen(true)}><HandCoins className="h-4 w-4" /> Record receipt</Button>
      <Drawer open={open} onClose={() => setOpen(false)} title="Record customer receipt" description="Dr Bank/Cash · Cr Receivable" width="520px">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Customer"><Select value={customerId} onChange={(e) => { setCustomerId(e.target.value); setAlloc({}); }}>{customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
            <Field label="Date"><Input type="date" value={receiptDate} onChange={(e) => setReceiptDate(e.target.value)} /></Field>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label={`Amount (${baseCurrency})`}><Input value={amount} onChange={(e) => setAmount(e.target.value)} className="text-end tabular" placeholder="0.000" /></Field>
            <Field label="Method"><Select value={method} onChange={(e) => setMethod(e.target.value)}>{["bank", "cash", "card", "cheque", "transfer"].map((m) => <option key={m} value={m}>{m}</option>)}</Select></Field>
            <Field label="Reference"><Input value={reference} onChange={(e) => setReference(e.target.value)} /></Field>
          </div>
          <div className="rounded-lg border border-line">
            <div className="border-b border-line px-3 py-1.5 text-[11px] uppercase tracking-wide text-ink-3">Allocate to open invoices</div>
            <div className="space-y-1.5 p-2">
              {custInvoices.length === 0 && <p className="px-1 text-[13px] text-ink-3">No open invoices — receipt will be recorded as unapplied credit.</p>}
              {custInvoices.map((inv) => (
                <div key={inv.id} className="flex items-center justify-between gap-3">
                  <span className="text-[13px] text-ink-2">{inv.invoiceNumber} · due {fmt(inv.amountDue)}</span>
                  <div className="flex items-center gap-1">
                    <Input className="h-8 w-28 text-end tabular" placeholder="0" value={alloc[inv.id] ?? ""} onChange={(e) => setAlloc({ ...alloc, [inv.id]: e.target.value })} />
                    <button className="text-[11px] text-accent hover:underline" onClick={() => setAlloc({ ...alloc, [inv.id]: String(inv.amountDue) })}>max</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between text-[13px]"><span className="text-ink-3">Allocated {fmt(allocSum)} · Unapplied {fmt(Math.max(0, amt - allocSum))}</span></div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="primary" size="sm" disabled={pending || amt <= 0 || allocSum > amt} onClick={() => start(async () => {
              const allocations = Object.entries(alloc).filter(([id, v]) => Number(v) > 0 && custInvoices.some((i) => i.id === id)).map(([invoiceId, v]) => ({ invoiceId, amount: Number(v) }));
              const r = await postReceiptAction(companyId, { customerId, receiptDate, amount: amt, method, reference: reference || undefined, allocations });
              if (r.ok) { toast({ kind: "success", title: `Receipt ${r.data?.receiptNumber ?? ""} posted` }); setOpen(false); reset(); router.refresh(); } else toast({ kind: "error", title: r.error });
            })}>Post receipt</Button>
          </div>
        </div>
      </Drawer>
    </>
  );
}

// ---------------------------------------------------------------------------
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1 block text-[12px] text-ink-2">{label}</span>{children}</label>;
}
