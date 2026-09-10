# NEXORA Accounting Architecture (Phase 3)

The financial system of record for the group. Built as a first-class NEXORA domain
on the existing permission, audit, workflow, file, notification, job and API
infrastructure — nothing was replaced.

## Principles (enforced, not aspirational)
- **Double-entry, always balanced.** The posting engine rejects any entry whose
  transaction-currency debits ≠ credits, and whose base-currency totals fall
  outside a one-minor-unit tolerance.
- **Posted entries are immutable.** Status goes `draft → posted → reversed`; a
  posted entry is never edited back to draft. Correction is by **reversal** (an
  opposite entry, reciprocally linked) or an **adjustment** entry.
- **Legal-company separation.** Every `JournalEntry.companyId` is one legal
  company; a single entry can never mix accounts from two companies. Brand,
  country, department, product, store, campaign and cost center are **analytical
  dimensions on the line**, never a substitute for the legal company.
- **Decimal-safe money.** All arithmetic uses `Prisma.Decimal` via `src/lib/money.ts`
  — never JS floating point. Currency minor units (KWD=3, USD=2, JPY=0), rounding
  policy and balancing tolerance derive from the currency.
- **Reports derive only from posted ledger lines** — operational metrics
  (campaign spend, store performance) are never silently treated as postings.
- **Financial access is a separate privilege.** `accounting.*`, `accounts.*`,
  `ar/ap/payments/banks/budgets/periods.*` plus special caps `accounting.post`,
  `accounting.reverse`, `periods.reopen`, `banks.sensitive`, `reports.financial*`.
  Operational Brand/Campaign visibility never grants any of them.

## Domain layout (`src/domain/accounting/`)
- `common.ts` — company-scoped authorization + settings/base-currency helpers.
- `settings.ts` — per-company `CompanyAccountingSettings` (§4): base currency,
  rounding, numbering prefixes, terms, lock/soft-close dates, and **system-account
  mappings stored as account IDs** (never by name, §6).
- `accounts.ts` — Chart of Accounts (§5): hierarchical, `normalBalance` derived
  from type, `allowPosting` header flag, `isSystem` protection; accounts with
  ledger history can be deactivated but never deleted.
- `fiscal.ts` — Fiscal years + periods (§7/§8): monthly period generation,
  no-overlap, the `open → soft_closed → closed → locked` status machine, and
  `assertOpenPeriod()` used by the engine for server-side posting-date control.
- `setup.ts` — journals config, cost centers, exchange rates
  (`resolveExchangeRate` = latest rate ≤ date), tax rates.
- `numbering.ts` — **concurrency-safe** sequences via `UPDATE … RETURNING` under a
  row lock inside the posting transaction (§13/§75). Two simultaneous posts can
  never share a number.
- `posting.ts` — **the posting engine** (`postJournalEntry`, `reverseEntry`,
  `validateJournal`, `getJournalEntry`). The single path all source modules post
  through; individual modules never insert posted `JournalLine` rows.
- `reports.ts` — General Ledger, Trial Balance, Profit & Loss, Balance Sheet, all
  from posted lines with dimension filters (the analytical-P&L foundation).
- `bootstrap.ts` — one-click company initialization (standard chart + journals +
  settings), so a company is ledger-ready without seed scripts (§106).

## The posting engine (`postJournalEntry`)
Atomic sequence: authorize (`accounting.post` in company scope) → parse/validate
schema → prepare (load accounts, assert same-company / active / posting-allowed,
per-line debit-XOR-credit ≥ 0, resolve FX, compute base amounts, assert balance)
→ `assertOpenPeriod` → **one transaction**: allocate number (row-locked) → create
entry (status `posted`, immutable) + lines → denormalized base totals → audit.
A double-click cannot create two entries; any failure rolls the whole thing back.

## Money & currency
- Line `debit`/`credit` are **base-currency** amounts (they balance and drive the
  trial balance directly). `transactionCurrency` / `transactionAmount` /
  `exchangeRate` preserve the original. Historical posted rates are never
  recomputed when future rates change (§40).

## Dimensions
`JournalLine` carries `brandId, countryId, departmentId, productId, storeId,
campaignId, costCenterId, customerId, supplierId`. These power P&L by Brand /
Country / Product / Store / Campaign and drill-down — using stable entity IDs,
never denormalized names.

## Security & concurrency
- Rate limiting (§1) protects finance mutation endpoints (`finance_post` bucket).
- IDOR: every read/write is company-scoped server-side; cross-company account use
  is rejected in the engine.
- Concurrency: row-locked number sequences + all multi-row writes in
  `prisma.$transaction`.

## What is built vs pending (see SPEC_COVERAGE + ACCOUNTING_SYSTEM_AUDIT)
Built & verified: rate limiting; foundation (settings, CoA, fiscal/periods,
journals, tax, FX, cost centers); the GL posting engine (post, reverse, numbering,
period control, immutability, invariants); GL/Trial Balance/P&L/Balance Sheet
reports; **Accounts Receivable (Increment C)** — customers, sales invoices
(draft→issue→GL), credit notes (issue + application), customer receipts with
transaction-safe allocation, AR aging and customer statements, all verified by 24
live double-entry invariants; the `/api/v1/accounting/*` surface; a balanced
posted-journal + AR demo seed.
**Accounts Payable (Increment D)** — suppliers, supplier bills (draft→post→GL),
supplier credits (post + application), supplier payments with transaction-safe
allocation, plus the Expense→GL bridge (approved expenses post Dr Expense / Cr
Cash|Payable); AP aging and supplier statements, verified by 22 live invariants.
**Bank / Cash / FX (Increment E)** — bank & cash accounts (each mapped to a GL
asset account), transfers between them (same- or cross-currency with realized FX to
gain/loss), bank reconciliation against a statement (cleared-line matching, metadata
only), and the cash-position report; verified by 17 live invariants.
Pending increments: Budgets + Cash Flow, and the Financial Intelligence dashboards
/ 360 integrations.

`bank.ts` holds bank accounts, transfers, reconciliation and cash position;
transfers post in base currency through the engine, plugging any cross-currency
base residual to FX gain/loss so the entry balances.

The AP domain mirrors AR: `suppliers.ts` (party master, `ap.*`), `ap.ts` (bills,
credits, payments, allocations, AP aging / supplier statement) and
`expenses-gl.ts` (the expense posting bridge). All post through the engine's
`prepareForPost` + `writePostedEntry` so sub-ledger and GL commit atomically.

### AR domain (`src/domain/accounting/`)
- `customers.ts` — the AR party master (company-scoped, `ar.*`).
- `ar.ts` — sales invoices, credit notes, receipts, allocations, and the AR aging /
  customer-statement reports. Documents drive the GL only through `posting.ts`; each
  posted document stores its `journalEntryId`. Issuing an invoice/credit note and
  posting a receipt commit the sub-ledger update and the GL post in one transaction
  via the engine's `prepareForPost` + `writePostedEntry` (so a posted document can
  never exist without its balanced ledger entry, or vice-versa).
