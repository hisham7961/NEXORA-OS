# NEXORA OS — Localization Audit (EN ↔ AR)

Release-gate localization audit for V1.0-RC. Branch `claude/v1-rc-localization` from
`1fa5d49`. Goal (§2): a user can switch NEXORA to Arabic and operate every normal
employee, management, admin and finance workflow without significant English-only UI.
Technical identifiers (API paths, HTTP methods, JSON keys, SKU, IBAN, URLs, schema
names) may remain English.

## Method (code-truth)

- **Single-source dictionary** — `src/i18n/dictionaries.ts` now stores each key as a
  `[English, Arabic]` pair, so EN↔AR key parity holds **by construction** (a key
  cannot exist in one locale but not the other). Same i18n layer as before: the
  `dictionaries` export and `createTranslator` are unchanged; `useI18n()` (client) and
  `getServerI18n()` (server) resolve `t`.
- **Parity test** — `tests/i18n-parity.test.ts` asserts identical key sets, no empty
  values, and that Arabic is not a verbatim copy of English (guards a placeholder AR
  dictionary). CI fails on any mismatch.
- **Hard-coded string detector** — `scripts/i18n-scan.mjs` flags likely untranslated
  user-facing English (JSX text nodes, `title=`/`description=`/`placeholder=`/`header:`
  /`label:`/`empty=` literals, `confirm("…")`). Technical strings, `className`, and
  lines marked `i18n-ignore` are skipped; `scripts/i18n-allowlist.json` holds exempt
  files/substrings and the ratcheting `baseline`. It runs in CI and blocks regressions.

## Classification

| Class | Rule |
|---|---|
| USER UI / ADMIN UI / FINANCE UI / SYSTEM MESSAGE | must translate |
| DEVELOPER ONLY (Developer Portal technical content, OpenAPI, permission keys) | English acceptable |
| DATA CONTENT (product/brand/company/customer/supplier names, user comments, campaign titles, uploaded docs, company-entered account names, knowledge content) | never auto-translated; only the UI labels around them |

## Baseline (code-truth scan at phase start)

- **2,477** hard-coded user-facing strings across **172** `.tsx` files (`src/app`,
  `src/components`), pre-localization.
- **99** application `page.tsx` routes (29 accounting, 11 admin, rest across modules).
- Dictionary at phase start: 138 keys (shell only). Target: full module coverage.

## Highest-leverage centralizations (localize once, cover everywhere)

- **Status values** — `StatusBadge` now translates via `status.*` (78+ values) with a
  humanized fallback for config-defined statuses. Covers status pills across all modules.
- Shared list chrome — `Pagination`, `ListToolbar` search already localized.

## Page completion matrix

Legend: ✅ done · — n/a · ◻ pending. Updated as module groups land; final state in
`docs/V1_RELEASE_CANDIDATE_AUDIT.md`.

Progress is tracked per commit group (§69): 1 shared/common/auth · 2 organization/tasks ·
3 marketing/creative · 4 products/regulatory/commerce · 5 CS/knowledge/files/discussions ·
6 attendance/subscriptions/workflows · 7 accounting · 8 admin/settings/operations/security ·
9 reports/import/export/rollout · 10 tests + final sweep.

_This document records the plan and method; the page-by-page completion state and the
final hard-coded-string count are reported in the RC audit at phase end._

## Final state (phase end)

- Hard-coded user-facing strings: **2,477 → 0** across 0 files (detector baseline pinned to 0).
- Dictionary: **2,337** EN/AR pairs; parity by construction, enforced by CI.
- All 99 application routes and their components localized; status/priority centralized.
- Full verdict, the §91 20-item report and reproduction steps: see
  [`docs/V1_RELEASE_CANDIDATE_AUDIT.md`](./V1_RELEASE_CANDIDATE_AUDIT.md).
