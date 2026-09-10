# NEXORA Accounting — System Audit & Production-Readiness Verdict (Phase 3 §115/§116)

Audit of the **actual code** on branch `claude/new-session-9incr7` after Increments
A–H. Every claim below was checked against the running system on PostgreSQL, not the
build script. Money figures are from the seeded demo company (Premier Care Cosmetics).

## 1. What was built (Increments A–H)

| Increment | Scope | Status | Live proof |
|---|---|---|---|
| A | Foundation: settings, chart of accounts, fiscal years/periods, journals, cost centers, tax rates, FX rates, numbering, money lib | ✅ | 29-account chart + 8 journals bootstrapped; period state machine |
| B | GL posting engine: post / reverse / validate, immutability, concurrency-safe numbering, period control; GL / Trial Balance / P&L / Balance Sheet | ✅ | 13 §101 invariants |
| C | Accounts Receivable: customers, invoices, credit notes, receipts, allocations, AR aging, statements | ✅ | 24 invariants |
| D | Accounts Payable: suppliers, bills, supplier credits, payments, allocations, expense→GL bridge, AP aging, statements | ✅ | 22 invariants |
| E | Bank / Cash / FX: accounts, transfers (realized FX), reconciliation, cash position | ✅ | 17 invariants |
| F | Budgets + Budget-vs-Actual + direct-method Cash Flow statement | ✅ | 4 checks vs GL |
| G | Financial Intelligence: dimensional P&L, company overview, 360 integration | ✅ | 8 checks vs GL |
| H | Hardening: extracted pure money math + committed tests, this audit, SPEC update | ✅ | 141 unit tests |

**Surface:** 19 domain modules under `src/domain/accounting/`, 63 REST routes under
`/api/v1/accounting/`, 6 migrations, full accounting UI (overview, chart, journal
workspace, customers, invoices, credit notes, receipts, suppliers, bills, supplier
credits, payments, bank & cash, reconciliation, budgets, reports, intelligence).

## 2. Non-negotiables — verified, not aspirational

- **Double-entry, always balanced.** The engine rejects any entry whose
  transaction-currency debits ≠ credits or whose base totals fall outside a
  one-minor-unit tolerance. Every source module (AR/AP/Bank/Expense) posts through
  the single engine path (`prepareForPost` + `writePostedEntry`); none inserts
  `JournalLine` rows directly. Seeded ledger: **Trial Balance balanced
  72,515.5 = 72,515.5**, **Balance Sheet balanced (A 56,615.5 = L 2,605.5 + E 54,010)**.
- **Posted entries are immutable.** Status `draft → posted → reversed`; correction is
  reversal/adjustment or document void (which reverses the GL). Verified: a posted
  entry cannot be re-reversed; a settled document cannot be voided.
- **Legal-company separation.** `JournalEntry.companyId` is one legal company; the
  engine rejects an entry mixing accounts from two companies. AR/AP/Bank writers
  reject a customer/supplier/account from another company (IDOR). Verified in C/D/E.
- **Analytical dimensions never substitute for the legal company.** Brand, country,
  product, store, campaign, department, cost center, customer, supplier live on the
  line; the legal company on the entry. Dimensional P&L uses these, never a company.
- **Decimal-safe money.** All arithmetic uses `Prisma.Decimal` via `src/lib/money.ts`
  and the pure `src/lib/accounting-math.ts` — no JS floating point. Currency minor
  units (KWD=3, USD=2, JPY=0), rounding policy and balancing tolerance derive from
  the currency. 18 committed unit tests lock this.
- **Reports derive only from posted ledger lines.** GL, Trial Balance, P&L, Balance
  Sheet, aging, cash flow, dimensional P&L all query `entry.status = "posted"`.
- **Financial access is a separate privilege.** `accounting.*`, `accounts.*`,
  `ar/ap/payments/banks/budgets/periods.*` + special caps (`accounting.post`,
  `accounting.reverse`, `periods.reopen`, `banks.sensitive`, `reports.financial*`).
  Operational Brand/Campaign visibility grants none of them. 17 of 19 domain modules
  assert a finance permission on every entry point; the other two are pure helpers
  (`common.ts`, `numbering.ts`).
- **Periods.** open → soft_closed → closed → locked; posting date validated
  server-side in the engine; reopening is elevated and reason-required.
- **Multi-currency.** Deterministic historical rate resolution (latest ≤ date);
  posted rates never recomputed; cross-currency bank transfers post realized FX to
  gain/loss. Per-settlement AR/AP revaluation is a documented period-end item (P3).
- **Rate limiting.** Every `/api/v1/accounting/*` mutation maps to the `finance_post`
  bucket; reads to `api_sensitive` (`src/lib/api/handler.ts`).

## 3. Findings — P0 / P1 / P2 / P3

**P0 (blocker): none.** No unbalanced posting path, no cross-company leak, no
mutable posted entry, no float money, no seed-only module.

**P1 (should fix before heavy production use): none open.** All AR/AP/Bank writers
are company-scoped and IDOR-guarded; all documents post atomically with their GL.

**P2 (worth doing, not blocking):**
- P2-1 Multi-line **foreign-currency** invoices/bills rely on the engine's
  one-minor-unit balance tolerance; a document with many lines at an extreme rate
  could in principle drift beyond tolerance. Domestic documents (the vast majority)
  are exact. Mitigation: post a rounding-account plug when base drift exceeds
  tolerance. Not observed in practice.
- P2-2 Bank reconciliation matches by manual line clearing; no statement-file import
  / auto-match yet.
- P2-3 Budget-vs-Actual compares annual (or whole-period) amounts; `periodMonth` is
  stored but the report does not yet break actuals out by month.

**P3 (future):**
- P3-1 Period-end FX revaluation of open AR/AP at the closing rate (realized FX on
  cross-currency **transfers** is built).
- P3-2 Recurring journals / accruals scheduler.
- P3-3 Statement (PDF) export and CSV import for customers/suppliers/journals.
- P3-4 Consolidated (multi-company) financial statements with elimination.

## 4. Exit-gate checklist (§40-style)

| Gate | Result |
|---|---|
| No P0 findings | ✅ |
| Double-entry enforced, posted entries immutable | ✅ (13 invariants) |
| Legal-company separation + IDOR guards | ✅ (C/D/E cross-company tests) |
| Decimal-safe money, currency minor units | ✅ (18 unit tests) |
| Periods open/close/lock control posting | ✅ |
| Multi-currency deterministic + realized FX on transfers | ✅ |
| Reports from posted lines only; TB & BS balance | ✅ (balanced on seed) |
| Financial access is a separate privilege | ✅ |
| Rate limiting on finance mutations | ✅ |
| API parity (REST for every module) | ✅ (63 routes) |
| Migrations apply cleanly; build passes; tests green | ✅ (6 migrations, 141 tests, build clean) |
| No seed-only modules (everything has a real write path) | ✅ |

## 5. Production-readiness verdict (§116)

**NEXORA Accounting is ready for controlled production use** as the group's financial
system of record for **General Ledger, Accounts Receivable, Accounts Payable,
Expenses, Bank & Cash (with reconciliation and realized FX on transfers), Budgeting,
and management financial reporting/intelligence.**

The core accounting invariants that make a ledger trustworthy — balanced
double-entry, immutable posted transactions, correction only by reversal, legal-
company separation, deterministic Decimal money, period control, and posted-only
reporting — are enforced in code and proven by live invariant checks and committed
unit tests, with a balanced trial balance and balance sheet on realistic seed data.

**Conditions for controlled rollout:**
1. Treat the P2 items as the first post-launch backlog — in particular add the
   rounding-plug safeguard (P2-1) before processing high-volume multi-line
   foreign-currency documents.
2. Run real chart-of-accounts and opening balances per legal company via the
   one-click bootstrap + opening-balance journal, and have a controller confirm the
   opening trial balance before go-live.
3. Period-end FX revaluation (P3-1) is manual until built; disclose this to finance.

No blocking (P0) or must-fix (P1) issue remains open. Beyond the P2/P3 backlog above,
the system meets the Phase 3 non-negotiables.
