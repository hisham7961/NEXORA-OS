# NEXORA Phase 4 — Gap Register (code-truth)

Built by inspecting **actual code + running PostgreSQL** at the audited baseline
`4434ea0`, not SPEC statuses. Each item verified as still-incomplete before listing.
Classification: **P0** production blocker / security / data integrity · **P1**
required for real rollout · **P2** important productivity/administration · **P3**
future. This register drives the Phase 4 increments (A–I).

## Accounting (Increment A)
| # | Gap (verified) | Class | Plan |
|---|---|---|---|
| A1 | Multi-line FX base residual could exceed tolerance; no explicit plug | P1 | **Done §2** — rounding-adjustment line, base Dr==Cr exact |
| A2 | Budgets compare whole-period only; `periodMonth` unused | P2 | **Done §3** — periodicity + monthly Budget-vs-Actual |
| A3 | No bank statement import | P2 | **Done §4** — CSV import, validate/preview/dedupe, never posts GL |
| A4 | Reconciliation is manual line-clearing only; no matching | P2 | **Done §5** — suggested matches by amount/date/reference |

## Admin & productivity (Increment B)
| # | Gap (verified) | Class | Plan |
|---|---|---|---|
| B1 | `SystemSetting` read-only viewer; `settings.manage` unused; no write path | P1 | Typed settings registry + writable admin UI (§6–8) |
| B2 | `SavedView` schema stub; read-only list in /reports; never written | P2 | Real saved views: filters/sort/columns, private/shared (§9) |
| B3 | `Favorite` unused stub (no service/API/UI) | P2 | Favorite major entities + sidebar/Cmd-K surface (§10) |
| B4 | `RecentItem` unused stub; nothing tracks views | P2 | Bounded recent history, permission-filtered (§11) |
| B5 | `Comment` generic model unused | P2 | Activate as record comments (task/campaign/invoice…) (§23) |
| B6 | Team/Dept/Project: edit/archive exist in service+API+form but no per-row/detail UI; Departments have no page | P2 | Detail pages + per-row edit/archive (§51) |

## Reporting & data movement (Increment C)
| # | Gap (verified) | Class | Plan |
|---|---|---|---|
| C1 | No generic Report Builder (only accounting reports) | P2 | Field-registry report builder, permission-safe, export (§13–16) |
| C2 | No data export (CSV/XLSX) on any list | P2 | Export via shared CSV lib, permission+scope identical (§17) |
| C3 | No import engine (no papaparse/xlsx dep) | P1 | One reusable Import engine + initial imports (§18–20) |
| C4 | No data-quality/go-live checks surface | P2 | Lightweight admin data-quality checks (§85) |

## Collaboration & personal workspace (Increment D)
| # | Gap (verified) | Class | Plan |
|---|---|---|---|
| D1 | Discussions are request-response (router.refresh); no SSE/WS | P2 | SSE realtime for messages/mentions/unread (§21–22) |
| D2 | `Notification.groupKey` has no index | P2 | Add index; keep grouping (§25) |
| D3 | My Day unread-discussions N+1 (count per channel) | P1 | Collapse to one grouped query (§25) |
| D4 | Global search excludes suppliers/customers/invoices/bills/journal, discussion messages | P2 | Extend search + Cmd-K create actions (§54–55) |
| D5 | My Day lacks accounting attention items | P2 | Add finance approvals/overdue AR/AP due (§12) |

## Security (Increment E)
| # | Gap (verified) | Class | Plan |
|---|---|---|---|
| E1 | No security headers / CSP / HSTS; no middleware | P1 | next.config headers + middleware (§30) |
| E2 | No MFA / TOTP; no 2FA fields on User | P1 | TOTP enable/verify/recovery + policy (§26–27) |
| E3 | No session management UI; only current-session logout | P1 | List/revoke sessions, sign-out-everywhere (§28) |
| E4 | No CSRF/origin defense beyond SameSite=lax | P2 | Origin check on mutations (§31) |
| E5 | ApiToken has no lifecycle (create/revoke/rotate/scopes) | P2 | Token lifecycle + one-time secret (§32) |
| E6 | No security-event visibility surface | P2 | Surface auth/rate-limit events (§29) |

## Platform reliability (Increment F)
| # | Gap (verified) | Class | Plan |
|---|---|---|---|
| F1 | Scheduler single-process; overlap guard is in-memory only | P1 | PostgreSQL advisory lock / job leasing (§37–38) |
| F2 | Rate-limit memory store per-process (documented) | P1 | Enforce Upstash in production readiness (§73–74) |
| F3 | No webhook subsystem | P2 | Webhook config + signed delivery + history (§36) |
| F4 | FeatureRegistry seed-driven (4 stale rows); no reconciliation | P2 | Reconcile against routes/permissions (§33) |
| F5 | Developer Portal display-only; no OpenAPI/endpoint registry | P2 | Live endpoint registry + OpenAPI (§34–35) |
| F6 | No storage integrity/orphan check | P2 | Admin file-integrity job (§45–46) |
| F7 | One combined /health; no liveness/readiness split | P2 | Split probes (§40) |
| F8 | Audit old/new JSON not surfaced; no export | P2 | Diff view + audit export (§48–49) |

## Localization / UX / performance (Increment G)
| # | Gap (verified) | Class | Plan |
|---|---|---|---|
| G1 | ~70%+ of page-level strings hard-coded English (only 41/172 files use t()) | P1 | Wire critical surfaces through i18n (§56–57) |
| G2 | RTL not audited on new/most screens | P2 | RTL audit; logical CSS (§58) |
| G3 | Responsive/accessibility not audited | P2 | Practical WCAG-AA pass (§59–60) |
| G4 | Tables lack sort/column-visibility/bulk actions | P2 | Table productivity + safe bulk actions (§52–53) |
| G5 | No performance baseline / large-dataset validation | P2 | Baseline + indexes/pagination (§61–64) |

## Group rollout (Increment H)
| # | Gap (verified) | Class | Plan |
|---|---|---|---|
| H1 | No guided company onboarding | P1 | Onboarding wizard + completion status (§70) |
| H2 | Opening balances have no controlled go-live workflow | P1 | Import→validate→TB preview→confirm→post (§71) |
| H3 | No environment readiness validation beyond secret assert | P1 | Production config validation, fail-closed (§73) |
| H4 | No runbooks (backup/restore, staging, production, migration) | P1 | docs/* runbooks (§43–44, §75–77) |
| H5 | No UAT scenarios / go-live checklist | P2 | docs + checklist surface (§72, §81–82) |

## Final audit (Increment I)
Route/module/admin/security audits, accounting regression, data integrity,
performance, SPEC rebuild, V1 verdict (§93–102) → `PRODUCTION_READINESS_AUDIT.md`.

---
### Not required for V1 (documented roadmap, §103)
Corporate consolidation & elimination; period-end unrealized FX revaluation
(manual, documented); bank API feeds; BPMN-level workflow modeling; large BI cube;
native mobile app; AI features.
