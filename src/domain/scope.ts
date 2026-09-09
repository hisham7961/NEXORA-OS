import { scopeWhereFor, type Principal } from "@/lib/permissions/engine";
import type { ScopeDimension } from "@/lib/permissions/catalog";

/**
 * Merge a permission-derived scope filter with additional query conditions.
 * The service layer uses this so LIST/aggregate queries only ever touch records
 * inside the caller's scope (§3, §69) — server-side, never UI-only.
 */
// Returns `any` deliberately: this is a dynamic filter merged into strongly-typed
// Prisma `where` clauses across many models. The shape is validated by tests.
export function scopedWhere(
  principal: Principal,
  permission: string,
  dims: ScopeDimension[],
  extra: Record<string, unknown> = {},
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any {
  const scope = scopeWhereFor(principal, permission, dims);
  if (Object.keys(scope).length === 0) return extra;
  if (Object.keys(extra).length === 0) return scope;
  return { AND: [scope, extra] };
}

export const DIMS_CBC: ScopeDimension[] = ["companyId", "brandId", "countryId"];
export const DIMS_BRAND: ScopeDimension[] = ["brandId"];
