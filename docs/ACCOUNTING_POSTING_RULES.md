# NEXORA Accounting Posting Rules (Phase 3)

Every system-generated journal identifies its `sourceType`/`sourceId` (§80) and is
built from **configurable account selections** (company accounting settings /
account mappings), never hard-coded English names (§6). Amounts shown are the
debit/credit sides; the engine converts to base currency and balances.

Legend: Dr = debit, Cr = credit. Accounts reference `CompanyAccountingSettings`
mappings (e.g. *Receivable* = `receivableAccountId`).

## Manual Journal (built)
Entered directly in the journal workspace; balanced by the user; `sourceType =
ManualJournal`. No implicit lines.

## Reversal (built)
`sourceType = Reversal`. A new entry with every line's debit/credit swapped,
reciprocally linked (`reversalOfEntryId` ↔ `reversedByEntryId`); the original moves
to status `reversed`. Reason required; posting date must be in an open period.

## Opening Balance (built via engine, journal `OB`)
`sourceType = OpeningBalance`. Balanced opening entry (e.g. Dr Cash / Cr Capital).
Normal reversal rules apply once posted.

---
AR patterns below are **built** (Increment C). AP/Expense/Bank (D–E) remain the
**intended** patterns, documented so the mappings are settled before implementation.

## Sales Invoice (built — Increment C)
On issue: **Dr Receivable** (invoice total, `customerId` dimension) · **Cr Revenue**
(net, one credit per line to the line's revenue account with full analytical
dimensions) · **Cr Output Tax** (tax, aggregated by output-tax account). Journal
`SJ`, `sourceType = SalesInvoice`. Drafts carry no GL; issuing allocates the invoice
number and posts atomically. Posted invoices are corrected by credit note or void
(void reverses the GL), never edited.

## Customer Credit Note (built — C)
On issue, mirrors the invoice against receivable: **Dr Revenue / Dr Output Tax · Cr
Receivable** (per configured accounts, `customerId` dimension). Journal `SJ`,
`sourceType = CreditNote`. Applying a credit note to an open invoice is a sub-ledger
contra (both sides already sit in Receivable) — it reduces the invoice balance with
no new GL. Unapplied credit is tracked as the note's remaining balance.

## Customer Receipt (built — C)
**Dr Bank/Cash · Cr Receivable** (`customerId` dimension), journal `CJ`,
`sourceType = CustomerReceipt`. Allocated to one or more open invoices in the same
atomic transaction; allocations can never exceed the receipt amount or an invoice's
balance due. Unapplied receipt value is retained as customer credit and can be
allocated later.

## Supplier Bill (built — Increment D)
On post: **Dr Expense/Asset/Inventory** (per line, to the line's chosen account with
full analytical dimensions) · **Dr Input Tax** (recoverable, aggregated by input-tax
account) · **Cr Payable** (total, `supplierId` dimension). Journal `PJ`,
`sourceType = SupplierBill`. Draft → open on post; void reverses the GL.

## Supplier Credit (built — D)
On post, mirrors the bill against payable: **Dr Payable · Cr Expense · Cr Input
Tax**. Journal `PJ`, `sourceType = SupplierCredit`. Applying to an open bill is a
sub-ledger contra (no new GL); unapplied credit is tracked.

## Supplier Payment (built — D)
**Dr Payable · Cr Bank/Cash** (`supplierId` dimension), journal `BJ`,
`sourceType = SupplierPayment`. Allocated to open bills atomically with no
over-allocation; unapplied value retained for later allocation.

## Expense (built — D)
An approved Expense posts on demand: **Dr Expense** (the category's mapped GL
account, or an override) · **Dr Input Tax** (if any) · **Cr Bank/Cash** (company-paid)
or **Cr Payable** (when a supplier is linked). Journal `EJ`, `sourceType = Expense`.
Posting requires the expense be approved and the actor hold `accounting.post`; an
already-posted expense cannot be posted twice.

## Bank Transfer (built — Increment E)
Posted in base currency, journal `BJ`, `sourceType = BankTransfer`. Both accounts
must map to a GL account. Same currency: **Dr destination · Cr source** (equal base
amounts). Cross-currency: each leg is converted to base at its own rate; the base
residual posts to **FX Loss** (`fxLossAccountId`, when the source base exceeds the
destination) or **FX Gain** (`fxGainAccountId`), so the entry always balances. One
atomic transaction.

## Bank Reconciliation (built — E)
A reconciliation session marks posted GL lines on a bank's account as *cleared*
(metadata only — posted amounts stay immutable) up to a statement date, tracks the
cleared balance, and completes only when it matches the statement (or is explicitly
forced with the difference recorded).

## FX Settlement Difference (pending — period-end revaluation)
When a receipt/payment settles at a different rate than the invoice/bill posting
rate, the residual belongs in **FX Gain** (`fxGainAccountId`) / **FX Loss**
(`fxLossAccountId`). The realized-FX posting on cross-currency **transfers** is built
(above); per-settlement revaluation of open AR/AP at period close is a documented
period-end process for a later increment. Balances are never silently adjusted.

## Rounding (built — Phase 4 §2)
The posting engine guarantees **base-currency Debit == Credit exactly** on every
posted entry. Per-line base conversion of a multi-line foreign-currency document can
accumulate a sub-tolerance residual; rather than leave a base imbalance or mutate a
real line, the engine posts an explicit **Rounding adjustment** line to
`roundingAdjustmentAccountId` (falling back to `roundingAccountId`) so the entry
balances to the minor unit. A residual larger than one minor unit per line is a
genuine imbalance and is rejected. The rounding line is shown on the journal and the
adjustment amount is audited. Transaction-currency totals are never altered.
