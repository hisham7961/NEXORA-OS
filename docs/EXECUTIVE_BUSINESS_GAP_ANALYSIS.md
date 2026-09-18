# NEXORA — Executive Business Gap Analysis

**Audit branch:** `claude/nexora-360-audit` · **Date:** 2026-09-17

Reasoning as the operators of a multi-company, multi-brand cosmetics group. Every gap is
classified **BUILD IN NEXORA / INTEGRATE / KEEP MANUAL (V1) / DO NOT BUILD** to prevent
mega-ERP bloat (§56/§57). "Current impact" is grounded in the code-truth feature-reality audit.

## The one-line executive picture

NEXORA today is a **genuinely wired operating platform** — real permissions, real accounting,
real work-management, no fake buttons — with two categories of gap that stop it from *running the
group*: (1) a handful of modules that look complete but have **no data-entry path** (Documents,
Certificates, Creative Library, Expenses), and (2) **management-visibility** aggregation that
exists per-module but not yet as a single cross-group cockpit.

## A. "Looks complete, cannot be operated" — highest business priority

| Gap | Real scenario | Current impact | Who | Recommendation |
|---|---|---|---|---|
| **Documents have no create/upload** (DOM-01) | Regulatory needs to attach a manufacturer dossier / free-sale certificate to a market. | Document records are seed-only; users cannot add one. A compliance platform can't hold compliance docs. | Regulatory, QA | ✅ **DONE** — `createDocument` (scope-guarded, audited, session-derived owner) + `NewDocumentButton` drawer on Documents. Metadata entry first; file attachment via the existing File platform is the follow-up. |
| **Certificates have no create/renew** (DOM-02) | A certificate expires; someone must add the renewal with a new expiry. | Expiry tracking & reminder sweeps run only over seed rows. | Regulatory | ✅ **DONE** — same path serves certificates; `renewDocument` bumps version + re-arms the reminder ledger so the expiry sweep fires on the new expiry. |
| **Expenses read-only** (DOM-06) | An employee submits a marketing expense for approval + posting. | No `expense.create`; only a post-to-journal button on seed expenses. | Finance, all staff | **BUILD** — expense entry + approval → the posting engine already works. |
| **Creative Library dead write-path** (DOM-03) | A delivered, approved design should land in a reusable asset library. | `CreativeAsset` is never written; library shows seed only, rows not clickable. | Marketing, Design | **BUILD (small)** — write `CreativeAsset` on design delivery/approval; make rows open. |
| **Settings that don't drive behaviour** (DOM-04) | Admin sets "late threshold = 10 min" / "default currency". | 11 of ~14 settings persist + audit but are ignored at runtime. | Admin | **BUILD (wiring)** — read the settings that exist at their point of use, or remove the dead toggles (don't ship inert config). |

These are the difference between "demo-complete" and "operable". None is large; all reuse
machinery that already works (File platform, posting engine, approval engine).

## B. Executive visibility — the CEO/COO cockpit (§44/§45/§64/§65)

| Gap | Scenario | Current | Recommendation |
|---|---|---|---|
| **Group cockpit** | CEO wants company × brand × country performance, cash, profit, campaigns, regulatory risk, execution gaps in one 5-minute view. | Command Center is real and restrained but role-general; the cross-group roll-up (per-company P&L snapshot, cash, AR/AP aging, expiring registrations, blocked cases, pending approvals) exists per-module, not consolidated. | **BUILD (compose, don't invent)** — an exec surface that aggregates the *existing* report/intelligence endpoints. No new data model. |
| **Attention queue** | COO wants "what needs intervention now" across modules. | My Day is employee-focused; there is no management attention queue. | **BUILD (small)** — a role-adjusted queue over existing overdue/blocked/expiring signals. |
| **Ops Center truthfulness** | Admin trusts job health. | Scheduler reports false state (PLAT-01/02: rows born `success`, stuck `running` on crash). | **BUILD (fix)** — see technical audit; a cockpit is only as good as its truth. |

## C. Finance department needs (CFO/Controller, §47) — classify, don't auto-build

| Capability | V1 verdict | Rationale |
|---|---|---|
| Financial close checklist, period controls | **Have (partial)** | Period lock exists; a close checklist is a small BUILD. |
| Expense reimbursement, supplier payment runs | **BUILD near-term** | Expense entry (above) + batch payment run; posting engine ready. |
| Accruals, prepayments, fixed assets/depreciation | **KEEP MANUAL (V1)** → BUILD later | Real but not V1-blocking; needs schema. Don't bloat now. |
| Intercompany, consolidation, FX revaluation | **KEEP MANUAL (V1)** | Multi-entity group will need it; significant. Roadmap, not V1. |
| VAT/tax reporting | **BUILD near-term** (GCC VAT) | Tax lines exist on documents; a VAT return report is a reporting BUILD. |
| Cash forecasting, collections | **BUILD later** | Valuable; depends on AR/AP maturity. |

## D. Marketing / E-commerce / Regulatory / CS / Ops (§48–54)

| Area | Biggest real gap | Recommendation |
|---|---|---|
| Marketing | Asset library dead (DOM-03); campaign → expense → profitability loop needs expense entry (DOM-06). | BUILD the two write-paths; the campaign/publishing/WhatsApp state-machines are real. |
| E-commerce | Store performance entry is real; marketplace (Amazon/Noon/Shopify/Zid/Salla) integration is manual. | **KEEP MANUAL (V1)** per the manual-first decision; INTEGRATE later via API. Do not build connectors now. |
| Regulatory | Documents/Certificates entry (DOM-01/02) — the core of the module. | ✅ DONE (above). Registration workflow itself is real. File attachment is the remaining follow-up. |
| Customer Service | Cases/approved-answers/knowledge are real; approved-answer content correctly not auto-translated. | No V1 gap; consider adverse-event flagging later (cosmetics). |
| Logistics/Ops | No internal shipment/sample-tracking workflow. | **DO NOT BUILD in V1** — out of scope; INTEGRATE a warehouse/3PL later if a real scenario proves it. |
| HR/People Ops | Attendance real; leave/offboarding/access-revocation partial. | BUILD access-revocation on offboarding (security-relevant); leave management near-term. Avoid employee-surveillance features. |

## E. Explicitly DO NOT BUILD (bloat guard, §57)

Full WMS/3PL, pharmaceutical-grade PLM, marketplace connectors in V1, a second BI stack,
consumer-grade social scheduling, or any feature justified only by "another ERP has it." NEXORA's
value is being the **control + truth + execution** layer for the group, not every system it touches.

## Priority order (business/risk impact)

1. Documents + Certificates entry (compliance can't function without it).
2. Expense entry + approval (finance + all staff daily).
3. Settings wiring / remove inert toggles (admin trust).
4. Creative Library write-path (marketing reuse).
5. Group executive cockpit (compose existing endpoints).
6. VAT return + expense reimbursement/payment run (finance near-term).
7. Access-revocation on offboarding (security).
