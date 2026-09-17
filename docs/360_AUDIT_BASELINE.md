# NEXORA 360° Audit — Baseline Reconciliation (§1)

**Date:** 2026-09-17
**Audit branch:** `claude/nexora-360-audit`
**Audit baseline SHA:** `8a86f84` (created from `origin/claude/new-session-9incr7`)

## Source branches inspected

| Branch | Head SHA | Role |
|---|---|---|
| `claude/new-session-9incr7` | `8a86f84` | Operational branch — **authoritative, most-complete baseline** |
| `claude/v1-rc-localization` | `9c5c144` | V1 release-candidate / localization work |
| (Phase-4 audited head) | `1fa5d49` | Prior audited application state |

## Divergence analysis (code-truth)

The two branches do **not** meaningfully diverge. `git merge-base` of the two is
`9c5c144` — i.e. the **entire** `v1-rc-localization` branch is already contained in
`new-session-9incr7`, merged via **PR #1** (`8a86f84`, "Merge pull request #1 from
hisham7961/claude/v1-rc-localization").

`new-session-9incr7` therefore = full localized application (all 28 RC commits) **plus**
three deployment-only commits on top of the RC head:

| SHA | Commit | Files | Classification |
|---|---|---|---|
| `fa51d7a` | ops: add production Docker deployment | `Dockerfile.production`, `docker-compose.production.yml`, `.dockerignore` | deployment-only |
| `76e6851` | ops: rebuild application on GitOps updates | `docker-compose.production.yml` (+1 line) | deployment-only |
| `8a86f84` | Merge PR #1 (RC → operational) | merge commit | integration |

**Verification:** `git diff --name-only 9c5c144..8a86f84` touches **only**
`.dockerignore`, `Dockerfile.production`, `docker-compose.production.yml`. **No `src/`
or `prisma/` change** in the deployment delta — confirmed deployment-only.

## Baseline decision

- **Authoritative application state:** `new-session-9incr7` (it already contains every
  RC application/localization commit).
- **Deployment additions incorporated:** the three ops commits above (already present).
- **Commits excluded:** none — the operational branch is a clean superset; there is no
  conflicting history to drop.
- **Conflicts:** none.
- **History:** preserved. The audit branch is a fast-forward-equivalent checkout of
  `8a86f84`; no rebase, squash, or force applied to either source branch.

**Final audit baseline SHA: `8a86f84`**, checked out as `claude/nexora-360-audit`.

`claude/v1-rc-localization` and `claude/new-session-9incr7` are left **untouched**. No
merge to `main`, no PR (§105).

## Runtime environment established for this audit (§7 — honest disclosure)

The directive forbids fabricated runtime results. Actual capabilities in this sandbox:

| Capability | Status | Notes |
|---|---|---|
| PostgreSQL 16 | **UP** | Docker daemon is absent, but the PG16 server binaries are present; a real cluster was `initdb`'d and started on `127.0.0.1:5433` (run as the `postgres` OS user). |
| `prisma migrate deploy` on clean DB | **PASS** | 26 migrations applied cleanly; `migrate status` → "up to date", zero drift. |
| Seed | **PASS** | 8 users, 3 companies, 4 brands, 9 products, 5 campaigns, 6 tasks + full accounting/AR/AP/bank/workflow demo data. |
| `next build` | **PASS** | Production build green. |
| App runtime (`next start`) | **UP** | Serving on `127.0.0.1:3100`; `/login` → 200, unauth root → 307 redirect. |
| Chromium (Playwright) | **Available** | Pre-installed at `/opt/pw-browsers`; used for the browser/screenshot layer. |
| Docker build of `Dockerfile.production` | **NOT RUN** | No Docker daemon in sandbox — the production image is reviewed statically (§31/§32), not built here. Disclosed, not fabricated. |
| Cross-browser WebKit/Firefox | **Limited** | Only Chromium is provisioned; WebKit/Firefox findings are marked "not executed" where they would require those engines. |
| Redis / real S3 | **Absent** | App runs without them (in-process/local fallbacks); external-integration behaviour reviewed statically. |

Seed identities (demo password `password`, demo login enabled) used for role/scope and
IDOR simulation: `admin@nexora.group` (super admin), `layla.management@nexora.group`
(group mgmt), `omar.marketing@nexora.group` (marketing KW/AE), `noura.marketing.sa@nexora.group`,
`sara.regulatory@nexora.group`, `dana.design@nexora.group`, `hana.cs@nexora.group`,
`yousef.finance@nexora.group`.
