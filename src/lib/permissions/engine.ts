/**
 * PERMISSION ENGINE (§3, §69)
 * ----------------------------------------------------------------------------
 * Pure, framework-free functions so they are trivially unit-testable. The web
 * app, the REST API and background jobs all evaluate access through these — UI
 * hiding is never the security boundary (§3 "Never rely on hiding UI buttons").
 *
 * Model:
 *   - A Principal carries the user's super-admin flag and their loaded role
 *     assignments (each = a set of permission keys + a scope).
 *   - `can()` answers a yes/no for a single action, optionally within a record's
 *     scope context.
 *   - `scopeWhereFor()` produces a Prisma `where` fragment that constrains LIST
 *     queries to only the records a user may see — an OR across their assignments.
 *   - `assertRecordInScope()` fail-closed guards a single-record read/write so a
 *     user cannot reach another brand/country by tampering with an id.
 */

import { moduleForPermission, SCOPE_DIMENSIONS, type ScopeDimension } from "./catalog";

export interface LoadedAssignment {
  roleKey: string;
  permissionKeys: Set<string>; // resolved from the role, plus "*" wildcard support
  companyId: string | null;
  brandId: string | null;
  countryId: string | null;
  departmentId: string | null;
  teamId: string | null;
  moduleKey: string | null;
  expiresAt: Date | null;
}

export interface Principal {
  userId: string;
  isSuperAdmin: boolean;
  assignments: LoadedAssignment[];
}

export type ScopeContext = Partial<Record<ScopeDimension, string | null | undefined>>;

/** Does this assignment's permission set grant the requested key? */
function grantsKey(assignment: LoadedAssignment, permissionKey: string): boolean {
  const keys = assignment.permissionKeys;
  if (keys.has("*")) return true;
  if (keys.has(permissionKey)) return true;
  // `manage` implies the standard CRUD/action set for the same module.
  const mod = moduleForPermission(permissionKey);
  if (keys.has(`${mod}.manage`)) return true;
  return false;
}

function notExpired(assignment: LoadedAssignment, now: Date): boolean {
  return !assignment.expiresAt || assignment.expiresAt.getTime() > now.getTime();
}

/**
 * Is `assignment` applicable to a request in `ctx` for `permissionKey`?
 * For every scope dimension the assignment restricts (non-null), the context
 * must provide a matching value. If the context omits a dimension the assignment
 * restricts, it does NOT match (fail-closed). A null assignment dimension = "all".
 */
function assignmentMatchesContext(
  assignment: LoadedAssignment,
  permissionKey: string,
  ctx: ScopeContext,
): boolean {
  if (assignment.moduleKey && assignment.moduleKey !== moduleForPermission(permissionKey)) {
    return false;
  }
  for (const dim of SCOPE_DIMENSIONS) {
    const restricted = assignment[dim];
    if (restricted == null) continue; // assignment allows all of this dimension
    const provided = ctx[dim];
    if (provided == null || provided !== restricted) return false;
  }
  return true;
}

/**
 * Core check. `ctx` is the scope of the resource being acted on (e.g. the brand
 * and country of a campaign). Omit `ctx` for a scope-independent capability
 * (e.g. "can this user view the campaigns module at all?").
 */
export function can(
  principal: Principal,
  permissionKey: string,
  ctx?: ScopeContext,
  now: Date = new Date(),
): boolean {
  if (principal.isSuperAdmin) return true;
  const context = ctx ?? {};
  for (const a of principal.assignments) {
    if (!notExpired(a, now)) continue;
    if (!grantsKey(a, permissionKey)) continue;
    if (assignmentMatchesContext(a, permissionKey, context)) return true;
  }
  return false;
}

/** True if the user has the permission in ANY scope (for nav/menu visibility). */
export function canAnywhere(principal: Principal, permissionKey: string, now: Date = new Date()): boolean {
  if (principal.isSuperAdmin) return true;
  return principal.assignments.some((a) => notExpired(a, now) && grantsKey(a, permissionKey));
}

/**
 * Build a Prisma `where` fragment restricting a LIST query to accessible records.
 * `dims` = the scope columns the target model actually has (e.g. Campaign has
 * companyId/brandId/countryId). Returns:
 *   - {}                              → unrestricted (super admin / global grant)
 *   - { OR: [...] }                   → union of per-assignment scope clauses
 *   - { id: "__deny_all__" }          → no granting assignment: deny everything
 */
export function scopeWhereFor(
  principal: Principal,
  permissionKey: string,
  dims: ScopeDimension[],
  now: Date = new Date(),
): Record<string, unknown> {
  if (principal.isSuperAdmin) return {};

  const clauses: Record<string, unknown>[] = [];
  let hasGlobalGrant = false;

  for (const a of principal.assignments) {
    if (!notExpired(a, now)) continue;
    if (!grantsKey(a, permissionKey)) continue;
    if (a.moduleKey && a.moduleKey !== moduleForPermission(permissionKey)) continue;

    // If this assignment restricts a dimension the model can't express, it cannot
    // legitimately grant access to these records — skip it (fail-closed).
    const unsupportedRestriction = SCOPE_DIMENSIONS.some(
      (dim) => a[dim] != null && !dims.includes(dim),
    );
    if (unsupportedRestriction) continue;

    const clause: Record<string, unknown> = {};
    for (const dim of dims) {
      if (a[dim] != null) clause[dim] = a[dim];
    }
    if (Object.keys(clause).length === 0) {
      hasGlobalGrant = true; // grants all records of this model
      break;
    }
    clauses.push(clause);
  }

  if (hasGlobalGrant) return {};
  if (clauses.length === 0) return { id: "__deny_all__" };
  return { OR: clauses };
}

/**
 * Fail-closed guard for a SINGLE record (§69). `record` supplies the scope
 * values for the dimensions the model has. Throws ForbiddenError if the user has
 * no assignment granting `permissionKey` whose scope matches this record.
 */
export function assertRecordInScope(
  principal: Principal,
  permissionKey: string,
  record: ScopeContext,
  dims: ScopeDimension[],
  now: Date = new Date(),
): void {
  if (principal.isSuperAdmin) return;
  const ctx: ScopeContext = {};
  for (const dim of dims) ctx[dim] = record[dim] ?? null;

  for (const a of principal.assignments) {
    if (!notExpired(a, now)) continue;
    if (!grantsKey(a, permissionKey)) continue;
    if (a.moduleKey && a.moduleKey !== moduleForPermission(permissionKey)) continue;
    const unsupportedRestriction = SCOPE_DIMENSIONS.some(
      (dim) => a[dim] != null && !dims.includes(dim),
    );
    if (unsupportedRestriction) continue;

    let matches = true;
    for (const dim of dims) {
      if (a[dim] != null && a[dim] !== (record[dim] ?? null)) {
        matches = false;
        break;
      }
    }
    if (matches) return;
  }
  throw new ForbiddenError(permissionKey);
}

export class ForbiddenError extends Error {
  status = 403 as const;
  code = "forbidden" as const;
  constructor(public permissionKey?: string) {
    super(
      permissionKey
        ? `Forbidden: missing permission "${permissionKey}" for this record's scope`
        : "Forbidden",
    );
    this.name = "ForbiddenError";
  }
}

export class UnauthorizedError extends Error {
  status = 401 as const;
  code = "unauthorized" as const;
  constructor(message = "Authentication required") {
    super(message);
    this.name = "UnauthorizedError";
  }
}
