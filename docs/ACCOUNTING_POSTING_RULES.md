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
The following are the **intended** patterns for the AR/AP/Expense/Bank increments
(C–E), documented here so the mappings are settled before implementation.

## Sales Invoice (pending — Increment C)
On post: **Dr Receivable** (invoice total) · **Cr Revenue** (net, per line revenue
account/dimensions) · **Cr Output Tax** (tax). Discounts/returns to their configured
accounts. Links `sourceType = SalesInvoice`.

## Customer Credit Note (pending — C)
Reduces receivable/revenue/tax: **Dr Revenue / Dr Output Tax · Cr Receivable**
(mirrors the invoice, per configured accounts). Unapplied credit tracked.

## Customer Receipt (pending — C)
**Dr Bank/Cash · Cr Receivable**, allocated to one or more open invoices
(allocations transaction-safe, no over-allocation).

## Supplier Bill (pending — Increment D)
**Dr Expense/Asset/Inventory** (per line) · **Dr Input Tax** (recoverable) · **Cr
Payable** (total). `sourceType = SupplierBill`.

## Supplier Credit (pending — D)
Mirror of the bill against payable, per configured accounts.

## Supplier Payment (pending — D)
**Dr Payable · Cr Bank/Cash**, allocated across bills.

## Expense (pending — D)
Company-paid: **Dr Expense · Cr Bank/Cash/Payable**. Employee-reimbursable: **Dr
Expense · Cr Employee/Clearing account**. Category maps a default GL account + tax.

## Bank Transfer (pending — Increment E)
Same currency: **Dr destination bank · Cr source bank**. Cross-currency: convert at
rate; any residual to **FX Gain/Loss**. One atomic transaction.

## FX Settlement Difference (pending — E)
When a receipt/payment settles at a different rate than the invoice/bill posting
rate, the residual posts to **FX Gain** (`fxGainAccountId`) or **FX Loss**
(`fxLossAccountId`).

## Rounding
Any document/base rounding residual beyond tolerance posts explicitly to the
**Rounding** account (`roundingAccountId`).
