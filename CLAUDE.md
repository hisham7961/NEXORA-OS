# NEXORA OS — engineering conventions

Central operating platform for a multi-company, multi-brand cosmetics group.
Read this before adding a module so new code matches the established pattern.

## Stack & commands

- Next.js 15 (App Router, RSC, Server Actions) · TypeScript (strict) · Tailwind v4.
- Prisma ORM. **Local dev = SQLite**, **production = PostgreSQL** (schema is portable).
- `npm run dev` · `npm run build` · `npm run setup` (generate+push+seed) · `npm run db:seed`
  · `npm run typecheck` · `npm run test` (Vitest).

## Non-negotiable rules

1. **Authorization is server-side.** Never rely on hiding UI. Every list/read/write
   goes through the permission engine (`src/lib/permissions/engine.ts`):
   - `can(principal, key, ctx?)` — yes/no for an action in a record's scope.
   - `scopeWhereFor(principal, key, dims)` — Prisma `where` filter for LIST queries.
   - `assertRecordInScope(principal, key, record, dims)` — fail-closed single-record
     guard (IDOR protection, §69). Catch `ForbiddenError` in pages → `<AccessDenied/>`.
   - `accessibleScopeIds(...)` — for org-entity lists whose OWN id is the scope value
     (Brand/Company/Country).
   Permission keys come from the single catalog (`src/lib/permissions/catalog.ts`).
2. **Everything is relational.** Cross-domain references are **indexed scalar FKs**
   (e.g. `brandId`), resolved for display in bulk via `getLookups()` + `refName()`
   (`src/domain/lookups.ts`). Formal Prisma relations only inside tight aggregate
   clusters (Task↔assignees, Campaign↔metrics, …).
3. **Statuses/types are Strings** backed by `StatusDefinition`/`WorkflowTemplate`
   (configurable). Render with `<StatusBadge module="…" status={value} />`; the five
   semantic categories live in `src/lib/status.ts`.
4. **Portability:** never use Prisma `enum`, scalar lists, `Json` type, or
   `mode: "insensitive"` (unsupported on SQLite). JSON is stored as `*Json` strings.
   Money is `Decimal`.
5. **API-first:** business logic lives in `src/domain/*` services shared by web pages
   and the `/api/v1` REST routes (`route()` wrapper enforces auth + error mapping).
6. **Audit** sensitive mutations via `writeAudit(...)`. **Soft-delete** important
   records with `archivedAt` (filter `archivedAt: null` in lists).

## Module recipe (mirror `Brands`)

Reference files: `src/domain/brands.ts`, `src/app/(app)/brands/page.tsx`,
`src/app/(app)/brands/[id]/page.tsx`.

- **Service** `src/domain/<m>.ts`: `xQuerySchema = listQuerySchema.extend({…filters})`,
  `listX(principal, query)` building `where` with `scopedWhere(principal, "<mod>.view",
  DIMS_CBC, extra)` (from `src/domain/scope.ts`) for models with company/brand/country
  columns — otherwise pass only the dims the model has. `getX(principal, id)` calls
  `assertRecordInScope`.
- **List page**: `const { principal, locale, denied } = await pageGuard("<mod>.view")`;
  parse `await searchParams` with the schema; render `<PageHeader/>`, `<ListToolbar/>`,
  `<Panel><DataTable/><Pagination/></Panel>`. `searchParams`/`params` are Promises.
- **Detail page**: load via service (catch `ForbiddenError` → `<AccessDenied/>`,
  `null` → `notFound()`), render `<TabBar/>` with `?tab=` sections.
- **API route** `src/app/api/v1/<res>/route.ts`: `route()` + `ok(rows, pageMeta(total, query))`.

## UI

Design tokens in `src/app/globals.css` (warm neutral / charcoal / plum, light+dark,
RTL/LTR). Use only components exported from `src/components/ui`, plus `ListToolbar`,
`Pagination`, and the entity chips. Dense tables, thin borders, subtle color,
`tabular` numerals. Intentional empty states. Locale-aware formatting via
`src/lib/format.ts`. Add UI strings to `src/i18n/dictionaries.ts` (en + ar).
