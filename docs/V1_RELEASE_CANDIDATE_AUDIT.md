# NEXORA OS — V1.0 Release-Candidate Audit

**Phase:** V1.0 RC — Localization Completion & Final Release Gate
**Branch:** `claude/v1-rc-localization` (from `1fa5d49`)
**Scope of this phase:** two objectives only — (1) complete English ↔ Arabic
user-facing localization, and (2) produce this final RC audit. No new feature phase,
no redesign, no AI, no merge to `main`, no PR (§90).

This document is code-truth: every claim below is backed by a command that runs in CI
or locally against `HEAD` of the branch.

---

## 1. Verdict (§89)

> **NEXORA V1.0 IS READY FOR RELEASE.**

All release-gate conditions hold on `HEAD`:

- **0 P0** defects, **0 P1** defects (localization defects are P1 by §88; there are none —
  see §11 below).
- Critical employee / management / administrative / finance UI is fully bilingual EN ↔ AR
  (§2 exit condition met — see §4).
- Localization CI gate green (parity + hard-coded-string ratchet) — §6.
- Full test suite green (158/158) — §8.
- Production build green — §9.
- Accounting math and permission semantics untouched (§67/§68) — §9/§10.
- Migrations clean, no drift, deploy-based (§ DB) — §12.

The remaining items in §13 are **cosmetic, non-blocking, and by-design** (browser-tab
`<title>` metadata, deliberately-English technical placeholder examples, and free-text
data content that must never be auto-translated). None affects a user's ability to
operate NEXORA in Arabic.

Per §90 this branch is **not merged** and **no PR is opened**. It is left ready for
human review.

---

## 2. What "done" means here (§2)

A user switches NEXORA to Arabic (RTL) and operates every normal employee, management,
administrative and finance workflow — dashboards, lists, detail pages, create/edit
drawers, action bars, status transitions, approvals, attendance, discussions,
notifications, reports, imports, accounting (AR/AP/bank/journal/statements) — without
hitting significant English-only UI. Technical identifiers (API paths, HTTP methods,
JSON keys, SKU, IBAN, URLs, color hex, workflow-stage keys) may stay English; they are
the only English strings that remain, and each is deliberately suppressed with a
documented reason (§13).

---

## 3. String inventory (§48/§49) — code-truth

| Measure | Value |
|---|---|
| Hard-coded user-facing strings at phase start (baseline) | **2,477** across 172 `.tsx` files |
| Hard-coded user-facing strings at `HEAD` | **0** across 0 files |
| `.tsx` files scanned (`src/app` + `src/components`) | 197 |
| Application `page.tsx` routes localized | 99 |
| Files carrying a documented `i18n-ignore` | 12 |
| Detector baseline (`scripts/i18n-allowlist.json`) | **0** (ratchet floor reached) |

Reproduce:

```bash
node scripts/i18n-scan.mjs      # → "Total hard-coded user-facing strings: 0 across 0 files"
```

The detector (`scripts/i18n-scan.mjs`) flags JSX text nodes and user-facing prop/field
literals (`title=`/`description=`/`subtitle=`/`placeholder=`/`header:`/`label:`/`empty=`
/`hint:`/`confirm(...)`), skips technical strings, `className`, `export const metadata`
title lines, and any line marked `i18n-ignore`. During this phase it was hardened once
to ignore TypeScript arrow-return generics (`() => Promise<T>`) that its JSX-text regex
had mis-read as `>Text<` nodes — a false-positive class only, no behavioural change to
suppression.

---

## 4. Coverage by area (§2 exit condition)

All localized to the single dictionary; each area verified by the detector reaching 0
and by production build:

- **Chrome / shared:** topbar, sidebar, command palette, toolbar, pagination, drawers,
  forms, toasts, 404, error boundaries, auth/login.
- **Employee workflows:** My Day, attendance + clock widget + corrections, tasks,
  daily checks (execution + verification), notifications, comments, bookmarks/saved views,
  profile.
- **Management / marketing:** campaigns (+ lifecycle action bar, metrics), creative
  design (+ versions), social publishing (+ coverage matrix), WhatsApp campaigns,
  brands / companies / markets / products / teams / employees, registrations (regulatory).
- **Administrative:** admin settings, roles & assignments, permission tester, API tokens,
  webhooks, MFA/session security, import wizard, report builder, discussions/channels.
- **Finance / accounting:** chart of accounts, journal + workspace, AR (invoices,
  credit notes, receipts, customers), AP (bills, supplier credits, payments, suppliers),
  bank/cash/FX + reconciliation, budgets, opening balances, financial statements
  (P&L / balance sheet / cash flow), financial intelligence, expenses, opening/close of
  periods — with **professional Arabic accounting terminology** (§28).
- **Status & priority:** centralized — `StatusBadge` renders through `status.*` keys and
  lifecycle buttons/filters resolve statuses through the same keys, so a status pill or a
  transition button is Arabic everywhere at once.

---

## 5. One localization system (§5)

Single source of truth: `src/i18n/dictionaries.ts`, where every key is a
`[English, Arabic]` pair (`T = { "key": ["EN","AR"] } satisfies Record<string, Pair>`).
The `dictionaries.en` / `dictionaries.ar` maps are derived from those pairs, so a key
**cannot** exist in one locale but not the other — parity holds by construction.
`createTranslator(locale)` returns `t(key, vars?)` with `{var}` interpolation;
`useI18n()` (client) and `getServerI18n()` (server) expose it. No second i18n mechanism
was introduced.

- **Total keys:** **2,337** (each an EN/AR pair).

---

## 6. EN/AR parity + CI release gate (§6/§50)

**Parity test** — `tests/i18n-parity.test.ts` asserts: identical key sets EN↔AR, no
orphan keys, no empty value in either locale, and Arabic is not a verbatim copy of
English (< 35% identical). Measured identical share at `HEAD`: **0.2%** (5 keys — pure
technical tokens such as demo persona codes). Comfortably within the guard.

**CI gate** — `.github/workflows/ci.yml` runs, after typecheck and before the general
test/build steps, a dedicated **"Localization gate"**:

```yaml
- name: Localization gate (EN/AR parity + hard-coded-string ratchet)
  run: |
    npx vitest run tests/i18n-parity.test.ts
    npm run i18n:scan
```

It fails the build on any EN/AR key mismatch, any empty translation, a placeholder AR
dictionary, or a hard-coded user-facing string count above the recorded baseline. With
the baseline pinned to **0**, no new un-localized UI can ever merge (the count can only
ratchet down).

Reproduce:

```bash
npx vitest run tests/i18n-parity.test.ts   # 4 passed
npm run i18n:scan                           # exit 0, count 0
```

---

## 7. RTL / bidirectional (§ UI)

- `src/app/layout.tsx` sets `<html lang={locale} dir={dir(locale)}>`; `dir("ar") === "rtl"`.
- Design tokens and components are authored logical-direction-aware (`start`/`end`,
  `ms-*`/`me-*`, `ps-*`/`pe-*`) per the house rules in `CLAUDE.md`, so the Arabic view is
  right-to-left throughout without per-component overrides.
- Locale-aware number/date/currency formatting via `src/lib/format.ts`.

---

## 8. Tests (§ regression)

```bash
npm run test
```

**158 / 158 passing** across 15 files — including permissions/scope/IDOR,
money/decimal, financial metrics, file validation, rate-limit, password, and the new
i18n parity suite. No test was skipped, disabled, or quarantined.

---

## 9. Production build + accounting invariants (§67)

```bash
npm run build       # green — all 99 routes compile
npx tsc --noEmit    # clean
```

Accounting math is **untouched**. No file under the ledger/AR/AP/bank/budget/money
domains or `src/lib/status.ts` numeric logic was modified — only UI label bindings and
the dictionary changed. Verified:

```bash
git diff --name-only 1fa5d49..HEAD | grep -E "lib/permissions|domain/(accounting|ledger|ar|ap|bank|budget)|lib/money"
# → (no output)
```

---

## 10. Permission semantics (§68)

Unchanged. The permission engine (`src/lib/permissions/engine.ts`), the catalog, and
`scopeWhereFor` / `assertRecordInScope` / `accessibleScopeIds` were not modified.
Localization touched only presentation (labels rendered around already-scoped data);
every list/read/write still passes through the same server-side authorization path.

---

## 11. Defect register (§88)

| Severity | Count | Notes |
|---|---|---|
| P0 | 0 | — |
| P1 (localization defects included, §88) | 0 | detector 0, parity green, all critical flows bilingual |
| P2 | 0 blocking | see §13 residuals (cosmetic, by-design) |

No missing-key runtime fallbacks are possible for shipped UI: parity is by construction
and the detector floor is 0.

---

## 12. Database / migrations (§ DB)

- Deployment uses **migrations**, never `prisma db push`.
- **26** migrations under `prisma/migrations`, clean and in order; no schema drift.
- This phase authored **no** migration — it is app-layer (dictionary + UI bindings +
  scanner/CI) only. CI applies migrations to a fresh Postgres 16 service DB with
  `prisma migrate deploy` before typecheck/test/build.

---

## 13. Residual items — cosmetic, non-blocking, by-design

These are the only English strings remaining, each deliberate:

1. **Browser-tab `<title>` metadata** (`export const metadata` / Next.js title template).
   These render in the browser tab, never in the in-app UI, and cannot call the async
   translator from a static metadata object. Localizing them requires per-page
   `generateMetadata`. Tracked as a cosmetic follow-up; excluded from the operating-UI
   scope of §2. The detector skips these lines by rule.
2. **Technical example placeholders** (12 files, `i18n-ignore` with a stated reason):
   identifier/slug examples (`brand_manager`, `derma-plus`, `registration_approval`),
   workflow stage/transition keys (`in_review`, `approve`), field-key lists
   (`justification, budget_code`), event patterns (`invoice.posted, campaign.updated`),
   a color hex (`#8b5cf6`), a dimension format (`1080×1080`), an email format
   (`you@company.com`), and the HMAC signature note. These are technical identifiers the
   user types verbatim — English is correct per §2.
3. **Pre-provider crash boundary** (`src/app/global-error.tsx`): renders its own `<html>`
   when the React tree — including the i18n provider — has already failed, so it cannot
   use `t`. One static English fallback sentence, `i18n-ignore` documented.
4. **SEO `<meta name="description">`** in `src/app/layout.tsx`: search-engine metadata,
   not in-app UI; `i18n-ignore` documented.
5. **Free-text data content** (product/brand/company/customer/supplier names, user
   comments, campaign titles, uploaded documents, company-entered account names,
   knowledge articles): never auto-translated — only the UI chrome around them is. This
   is correct behaviour, not a gap.

---

## 14. §91 — 20 specific reportable items

1. Branch `claude/v1-rc-localization` from `1fa5d49`; app-layer only; not merged; no PR.
2. Single i18n system retained (`dictionaries.ts` pairs + `createTranslator`); no second mechanism.
3. Dictionary size: **2,337** EN/AR pairs.
4. EN↔AR key parity holds **by construction**; parity test enforces it in CI.
5. Empty-value guard: 0 empty EN, 0 empty AR.
6. Verbatim-copy guard: **0.2%** identical (threshold < 35%).
7. Hard-coded user-facing strings: **2,477 → 0**.
8. Detector baseline pinned to **0** (ratchet floor); no new un-localized UI can merge.
9. Detector hardened to drop TS arrow-return-generic false positives (`=> Promise<T>`).
10. CI "Localization gate" step added (parity test + `i18n:scan`), fails on parity/missing/regression.
11. 99 application routes localized across all modules.
12. Status/priority centralized through `status.*` — pills, filters and lifecycle buttons localize together.
13. Professional Arabic accounting terminology applied across AR/AP/bank/journal/statements (§28).
14. RTL: `dir="rtl"` for Arabic at the document root; logical-direction CSS throughout.
15. Full test suite: **158/158** green, none skipped.
16. Production build: green; `tsc --noEmit`: clean.
17. Accounting math untouched (§67) — no ledger/AR/AP/bank/budget/money file changed.
18. Permission semantics untouched (§68) — engine/catalog/scope helpers unchanged.
19. Migrations: 26, clean, deploy-based; this phase added none.
20. Defects: **0 P0, 0 P1**; residuals in §13 are cosmetic/by-design.

---

## 15. Reproduce the whole gate

```bash
npm ci
npx prisma generate
npx prisma migrate deploy          # against a clean Postgres 16
npm run typecheck                  # clean
npx vitest run tests/i18n-parity.test.ts   # 4 passed
npm run i18n:scan                  # 0 across 0 files, exit 0
npm run test                       # 158 passed
npm run build                      # green
```

---

## 16. Do-not-merge (§90)

This branch is complete and green but is intentionally **left unmerged with no pull
request**, ready for human review and sign-off.
