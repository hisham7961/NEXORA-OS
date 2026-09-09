# NEXORA OS

[![CI](https://github.com/hisham7961/NEXORA-OS/actions/workflows/ci.yml/badge.svg)](https://github.com/hisham7961/NEXORA-OS/actions/workflows/ci.yml)

**The central operating system for a multi-company, multi-brand cosmetics group.**

NEXORA OS unifies companies, brands, markets, products, marketing, creative,
commerce, regulatory affairs, customer service, knowledge, communication,
attendance, finance, approvals and analytics into one coherent, permission-aware,
API-first platform — not a collection of disconnected CRUD pages.

> This repository currently implements **Phase 1 — Foundation** (the shared
> platform everything else plugs into) plus working slices of several operational
> modules. The domain model, permission engine and API architecture are designed
> for the full scope. See [Roadmap](#roadmap).

---

## Highlights

- **Everything is relational.** A single normalized domain model (`prisma/schema.prisma`)
  connects brands ↔ companies ↔ markets ↔ products ↔ campaigns ↔ registrations ↔
  documents ↔ stores ↔ cases ↔ finance ↔ people. Entities reference each other;
  users never re-enter the same information.
- **RBAC + scope-based access control**, enforced **server-side** (never UI-only).
  A user can be "Marketing Manager for Brand Lumière in Kuwait & UAE" and nothing
  else. The engine produces both yes/no checks and query filters, and fail-closed
  guards protect single records against IDOR (changing an id in the URL/API).
- **API-first.** All data access flows through a domain/service layer used
  identically by the web app (server components / server actions) and the versioned
  REST API (`/api/v1/*`), so a future mobile app reuses the same logic and rules.
- **Premium, dense, bilingual UI.** A warm-neutral / charcoal / muted-plum design
  system with light + dark themes (both intentional, not inverted) and full
  Arabic (RTL) + English (LTR) support from day one.
- **No hidden systems.** Audit trail, background jobs, feature registry, system
  settings and status/workflow configuration are first-class, admin-visible tables.

## Tech stack

| Layer     | Choice |
|-----------|--------|
| Framework | Next.js 15 (App Router, RSC, Server Actions) · TypeScript |
| UI        | Tailwind CSS v4 · a bespoke component library · lucide icons |
| Data      | Prisma ORM · **PostgreSQL** (local dev + production) · versioned migrations |
| Auth      | Cookie sessions (HMAC-hashed tokens) · scrypt password hashing |
| Validation| Zod |
| Tests     | Vitest |

### Database (PostgreSQL, migrations)

PostgreSQL is the single database for **both** local dev and production — no
schema divergence. Deployment uses **Prisma migrations** (`prisma/migrations/`),
never `prisma db push`. Money is `Decimal` (Postgres `NUMERIC`); statuses/types
are Strings backed by configurable `StatusDefinition` / `WorkflowTemplate` rows.

```bash
docker compose up -d db      # local Postgres on :5432 (or use any Postgres)
cp .env.example .env         # DATABASE_URL already points at it
npm run setup                # prisma generate + migrate deploy + seed
```

- New migration after a schema change: `npm run db:migrate -- --name <change>`
- Apply migrations (CI / prod): `npm run db:deploy`

## Getting started

```bash
docker compose up -d db   # local PostgreSQL (or point .env at your own)
npm install
cp .env.example .env
npm run setup             # prisma generate + migrate deploy + seed the demo world
npm run dev               # http://localhost:3000
```

`npm run setup` seeds a realistic multi-company / multi-brand world. Sign in with
any demo account (password **`password`** for all):

| Account | Role & scope |
|---------|--------------|
| `admin@nexora.group` | Super Administrator (everything) |
| `layla.management@nexora.group` | Group Management (full-group visibility) |
| `omar.marketing@nexora.group` | Marketing Manager — **Lumière · Kuwait & UAE only** |
| `noura.marketing.sa@nexora.group` | Marketing Executive — **Derma+ · Saudi only** |
| `sara.regulatory@nexora.group` | Regulatory Specialist — Derma+ & Lumière |
| `dana.design@nexora.group` | Designer |
| `hana.cs@nexora.group` | Customer Service — Lumière · Kuwait |
| `yousef.finance@nexora.group` | Finance Manager — PremierCare |

Sign in as **Omar** vs **Layla** to see the navigation and Command Center adapt to
scope. Omar cannot see Derma+ / Saudi data anywhere — including via the API.

### Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Start the dev server |
| `npm run build` | Production build (runs `prisma generate`) |
| `npm run setup` | Generate client, push schema, seed |
| `npm run db:seed` | Re-seed the demo world |
| `npm run db:studio` | Prisma Studio |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run test` | Vitest (permission/scope/security tests) |

## The permission model (the critical requirement)

A **`RoleAssignment`** binds a `User` → `Role` **within a scope**
(`companyId?`, `brandId?`, `countryId?`, `departmentId?`, `teamId?`,
`moduleKey?`). A `null` dimension means "all of it". Roles are configurable
bundles of permission keys (`<module>.<action>`) drawn from a single
[catalog](src/lib/permissions/catalog.ts).

The pure, unit-tested [engine](src/lib/permissions/engine.ts) provides:

- `can(principal, key, ctx?)` — yes/no for an action in a record's scope.
- `scopeWhereFor(principal, key, dims)` — a Prisma `where` fragment that limits
  **list** queries to accessible records (an `OR` across the user's assignments).
- `assertRecordInScope(...)` — a **fail-closed** guard for single-record reads/writes
  (this is what stops the §69 IDOR attack).

Everything is enforced at the service layer, so the web app and the API share the
exact same rules. UI hiding is a convenience, never the security boundary.

## Project structure

```
prisma/
  schema.prisma        # the complete relational domain model
  seed.ts              # realistic multi-company / multi-brand demo world
src/
  app/
    (auth)/login       # sign-in
    (app)/             # authenticated shell (sidebar, topbar, command palette)
      page.tsx         # Command Center (§5)
      my-day/          # My Day (§6)
      …                # module screens
    api/v1/            # versioned REST API (same services as the web app)
    actions/           # server actions
  components/
    ui/                # design-system primitives (Button, Table, Badge, …)
    layout/            # shell: sidebar, topbar, command palette
    providers/         # theme + i18n
  config/navigation    # permission-gated navigation (§4)
  domain/              # service layer (Command Center, My Day, scoped queries, …)
  lib/
    permissions/       # catalog + engine + loader (RBAC + scopes)
    auth/              # password hashing, sessions, current-user
    api/               # response envelope, route handler, pagination
    audit/             # audit logging
    status.ts          # one controlled semantic status system (§46)
    format.ts          # locale-aware dates / numbers / currencies (§40)
  i18n/                # English + Arabic dictionaries
```

## Design system

Warm off-white surfaces · charcoal/graphite type · muted violet/plum accent ·
thin borders · subtle shadows · dense, excellent tables · five-category semantic
status colors (neutral / info / success / warning / critical). Light and dark are
both designed. Tokens live in [`globals.css`](src/app/globals.css).

## Roadmap

Built here: **Phase 1 foundation** — auth, companies, brands, markets, teams,
employees, permissions (matrix + tester), navigation, design system, audit, API
architecture — plus working slices of Command Center, My Day, tasks, campaigns,
registrations, certificates, customer service and daily checks, and the versioned
REST API.

Next phases extend the same foundation module-by-module (Work OS → Marketing &
Creative → Product & Regulatory → Commerce & Customer Service → Finance →
Management Intelligence → Platform Engineering) without redesigning the core.

## Security

Server-side authorization on every read/write, scoped queries, fail-closed record
guards (IDOR protection), scrypt password hashing, HMAC-hashed session tokens,
audit logging of sensitive actions, Zod validation, no raw error leakage, and an
architecture prepared for MFA. See [`src/lib/permissions`](src/lib/permissions)
and the security tests in [`tests/`](tests).
