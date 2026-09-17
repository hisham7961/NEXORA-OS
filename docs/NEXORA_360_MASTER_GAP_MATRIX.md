# NEXORA 360° — Master Gap Matrix

**Audit branch:** `claude/nexora-360-audit` · **Baseline:** `8a86f84` · **Date:** 2026-09-17

Consolidated findings from six independent code-truth workstreams (security, architecture/DB/perf,
accounting forensics, platform/jobs/files/devops, domain feature-reality, design/a11y/RTL), a live
Playwright runtime crawl, and deterministic scans (secrets, dependencies, governance, independent
SQL accounting invariants). Full per-workstream evidence is retained in the audit scratchpad
(`findings/agent-*.md`, `findings/runtime.md`).

**Severity:** P0 critical (security/financial integrity/data loss/total blocker) · P1 serious
business/authorization/core-workflow failure · P2 important workflow/security/design · P3 polish/scale.
**FACT** = proven from code/runtime; **REC** = recommendation/judgement.
**Status:** ✅ FIXED this audit · ▢ OPEN (documented).

## Score by count

| Severity | Found | Fixed this audit | Open |
|---|---|---|---|
| P0 | 1 | 1 | 0 |
| P1 | 6 | 2 | 4 |
| P2 | ~28 | 3 | ~25 |
| P3 | ~24 | 0 | ~24 |

## P0 — critical

| ID | Area | Finding | Type | Evidence | Status |
|---|---|---|---|---|---|
| FIN-01 | Accounting | Reversed journal entries are dropped from every ledger-balance query while their contra stays → any reversal/void moves reported balances by the *negative* of the original amount (double-count); trial balance still reports `balanced=true`, masking it. Reproduced: reversing a 2,268 AR invoice gave 9,729.500 vs correct 11,997.500. | FINANCE/DATA (FACT) | `posting.ts:255` sets original `reversed`; 11 balance queries filtered `status:"posted"` only. Independently reproduced on seed DB. | ✅ FIXED — `LEDGER_STATUSES=[posted,reversed]` + DB-gated regression test. |

## P1 — serious

| ID | Area | Finding | Type | Evidence | Status |
|---|---|---|---|---|---|
| ARCH-06 | DB/Perf | `JournalLine` (highest-volume table) indexes every analytical dimension but **not** `companyId`, the column every financial report groups by. | PERFORMANCE/DATA (FACT) | schema `JournalLine` @@index list; verified absent in live DB. | ✅ FIXED — `@@index([companyId, accountId])` + migration. |
| PLAT-08 | DevOps | Production image `CMD npm start` with **no `prisma migrate deploy`**; a fresh prod DB is never schema-migrated → app fails on first query. Contradicts CLAUDE.md "deploy uses migrations". | OPERATIONS (FACT) | `Dockerfile.production`, `docker-compose.production.yml` app service. | ✅ FIXED — compose runs `migrate deploy` before start + liveness healthcheck (PLAT-13). |
| DOM-01 | Regulatory/Docs | **Documents** have no create/edit/upload path anywhere (`document.create/upsert` = 0 hits); API is GET-only; pages list-only. In a cosmetics-compliance platform, document records can only ever be seed data. | MISSING FEATURE (FACT) | grep across `src/`; documents API route. | ▢ OPEN — build a create/upload path (see Executive Gap Analysis). |
| DOM-02 | Regulatory | **Certificates** likewise have no create/edit path — expiry tracking & reminders operate only on seed rows. | MISSING FEATURE (FACT) | certificates pages + absence of write path. | ▢ OPEN — build create/renew path. |
| UX-01 | Design | `--font-sans` names "Inter" but Inter is **never loaded** (no `next/font`/`@font-face`/link). The app silently renders in system fonts and Inter's `font-feature-settings` are inert — the biggest "looks generic vs Linear/Attio" gap. | DESIGN (FACT) | `globals.css:59`; no font import anywhere. | ▢ OPEN — load Inter (or Geist) via `next/font`. |
| UX-13 | Accessibility | Shared `FormField`/`Field` primitive never associates `<label>` with its control (no `id`/`htmlFor`; label is a sibling) → **every** create/edit form lacks label↔input association (no click-to-focus, unreliable screen-reader announcement). | ACCESSIBILITY (FACT) | `FormField` component. | ▢ OPEN — associate label via `useId()`/`htmlFor`. |

(UX-02/03 token contrast, below, is also UX-P1 severity for accessibility.)

## P2 — important (selected; full list in workstream files)

| ID | Area | Finding | Type | Status |
|---|---|---|---|---|
| SEC-01 | Security/IDOR | `getApproval` had no scope guard + page ignored `denied` → any user could read any approval cross-company by id. | SECURITY (FACT) | ✅ FIXED — `assertRecordInScope` + `denied`/ForbiddenError→AccessDenied. |
| RT-01 | Runtime/Sec | CSP `strict-dynamic` blocked the inline no-FOUC theme script on **100% of routes** (console violation everywhere; anti-flash inert). | SECURITY/UX (FACT) | ✅ FIXED — nonce passed to ThemeScript; runtime-verified 0 CSP errors. |
| SEC-02 | Auth | Mandatory-MFA policy (`mfaRequiredForAdmins/Finance`) is advisory only — never enforced at login; no enrollment redirect. | SECURITY (FACT) | ▢ OPEN |
| FIN-02 | Accounting | Payment/receipt allocations never check currency → cross-currency mis-application. | FINANCE (FACT) | ▢ OPEN |
| FIN-03 | Accounting | Cross-currency transfer with omitted `toAmount` posts wrong destination amount (`bank.ts` dead ternary). | FINANCE (FACT) | ▢ OPEN |
| FIN-04 | Accounting | Bank reconciliation can't balance from a 2nd statement (no prior-cleared carry). | FINANCE (FACT) | ▢ OPEN |
| ARCH-01 | Data | Dead legacy `Invoice`/`Payment` models (0 rows); finance dashboard "open invoices" counts the empty legacy table, disconnected from real AR (`SalesInvoice`). | DATA/BUG (FACT) | ▢ OPEN |
| ARCH-03 | Security | Record comments authorize with scope-less `can()` and never `assertRecordInScope` the parent (§69) → scoped users mis-gated. | SECURITY (FACT) | ▢ OPEN |
| ARCH-07 | Perf | `RegistrationCase.companyId` unindexed on a hot scoped list. | PERFORMANCE (FACT) | ▢ OPEN (same pattern as ARCH-06). |
| ARCH-09 | Perf | Global search = leading-wildcard `ILIKE` across ~12 tables, no `pg_trgm` — non-sargable at scale. | PERFORMANCE (FACT) | ▢ OPEN |
| ARCH-10 | Data | No `@db.Decimal(p,s)` declared → all money is `NUMERIC(65,30)`. | DATA/TECH DEBT (FACT) | ▢ OPEN |
| PLAT-01/02 | Ops | Scheduler claims a minute before running with no crash recovery; run rows born `success`; jobs stick `running` on crash → Ops Center shows false state. | OPERATIONS (FACT) | ▢ OPEN |
| PLAT-04 | Perf | SSE polls DB per-connection every 3s, unbounded. | PERFORMANCE (FACT) | ▢ OPEN |
| PLAT-09 | Ops | No graceful shutdown; npm as PID 1 swallows SIGTERM → rollouts SIGKILL in-flight jobs. | OPERATIONS (FACT) | ▢ OPEN |
| PLAT-10/11/12 | DevOps | Root container; unslimmed image (devDeps+source, no `output:"standalone"`); `.dockerignore` leaks `.nexora-storage` dev files into image. | SECURITY/OPS (FACT) | ▢ OPEN |
| DOM-03 | Marketing | Creative Library is a dead write-path (`CreativeAsset` never written; orphaned from Design; rows not clickable). | MISSING/BUG (FACT) | ▢ OPEN |
| DOM-04 | Admin | System Settings control plane mostly inert — only 3 of ~14 editable settings are read at runtime (e.g. `attendance.lateThresholdMinutes`, `certificateExpiryDays`, `defaultCurrency`, `defaultTheme`, `digestEnabled` persist+audit but do nothing). | UX/BUG (FACT) | ▢ OPEN |
| DOM-06 | Finance | Expenses read-only/seed-only — no `expense.create` anywhere; only a post-to-journal button. | MISSING FEATURE (FACT) | ▢ OPEN |
| RT-02 | Runtime | `/answers` throws React #418 hydration mismatch. | BUG (FACT) | ▢ OPEN |
| RT-03 | Runtime | `/admin/go-live` never reaches network-idle (25s) — heavy/hanging request. | PERFORMANCE (FACT) | ▢ OPEN |
| UX-02/03 | A11y | Token contrast fails WCAG AA in light mode: `--ink-3` 2.6–2.97:1 (table headers, hints, placeholders); status-badge text on soft fills 2.86–4.0:1 (need 4.5), 44+ sites. | ACCESSIBILITY (FACT) | ▢ OPEN |
| UX-07 | RTL | Directional icons not mirrored (only 3/10 use `.flip-x`) → arrows point wrong way in Arabic. | UX (FACT) | ▢ OPEN |
| UX-09/10/11 | Design | Shared primitives bypassed: 20/30 detail pages hand-roll header instead of `PageHeader`; raw `<table>` in 11 files bypasses `DataTable`; `TabBar` in only 5. | DESIGN/TECH DEBT (FACT) | ▢ OPEN |
| UX-14 | A11y | `Drawer`/`CommandPalette` have no focus trap/restore. | ACCESSIBILITY (FACT) | ▢ OPEN |
| DEP-01 | Security | 10 npm advisories (1 critical, 5 high) — concentrated in **dev/build** tooling (vitest, vite, esbuild, postcss, prisma-config); limited production runtime exposure. | SECURITY (FACT) | ▢ OPEN — `npm audit fix`; evaluate next@16 separately. |

## P3 — polish / scale (summary)

SEC-03 login timing user-enumeration; SEC-04 daily-checks cross-brand manager gate; SEC-05 assignRole
doesn't bound granted permission set (REC); FIN-05..08 (amountPaid incl. credits, statement
opening-balance/mixed-currency, period-status enum, dead balancing helpers); ARCH-02/04/05/08/11/12/13/14
(minor indexes, naming, JSON-as-text); PLAT-03/05/06/07/14/15 (magic-byte/SVG upload validation, 50MB
vs 8MB action-limit mismatch, in-memory upload buffering, admin-gated webhook SSRF, single-instance
scale ceiling); DOM-05 (import wizard only customers/suppliers); UX-04..20 polish (drawer keyframes,
icon-only-button label miss, spacing, loading/empty-state consistency); governance (public repo,
default branch is a `claude/*` session branch, no signed commits, stale `main` tracks a dev-placeholder
`.env`); secrets (historical `.env` held only a labeled dev placeholder + SQLite URL — no real leak).

## Notable positives (verified — do NOT "fix")

- **Permission engine**: fail-closed; HMAC-stored session/API tokens; httpOnly+secure+sameSite cookies;
  scrypt/TOTP constant-time; AES-256-GCM sealed secrets; same-origin CSRF in `route()`; HMAC-signed
  webhooks; cron/job routes auth+manage gated. Nearly every single-record getter enforces scope
  (SEC-01 was the lone exception, now fixed).
- **Accounting invariants independently verified as HOLDING**: per-entry and per-transaction-currency
  double-entry; company separation; no posted entry in a closed period; AR/AP sub-ledger tie-out;
  per-company trial balance nets to zero; KWD 3-dp precision; journal immutability (API is GET-only);
  reversal writes a proper contra; FX missing-rate throws; rounding plug bounded; opening-balance
  once-only guard.
- **Feature wiring**: zero literal dead buttons (no `href="#"`, no empty `onClick`); every action file
  imported by a live control; every `getRowHref`/detail route resolves; Cmd-K create is real.
- **RTL discipline**: zero physical-direction classes (all `ms/me/ps/pe/start/end`); single lucide icon
  system; controlled 5-category status colours via central `StatusBadge`; no-FOUC dark mode.
- **Runtime health**: 0 routes ≥400, 0 HTTP 5xx, 0 desktop horizontal overflow for super-admin across 74 routes.
