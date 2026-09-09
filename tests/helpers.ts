import { permissionsForRoleKey } from "@/lib/permissions/load";
import type { LoadedAssignment, Principal } from "@/lib/permissions/engine";

/** Build a LoadedAssignment for a role key with an optional scope, for tests. */
export function assignment(
  roleKey: string,
  scope: Partial<Pick<LoadedAssignment, "companyId" | "brandId" | "countryId" | "departmentId" | "teamId" | "moduleKey" | "expiresAt">> = {},
): LoadedAssignment {
  return {
    roleKey,
    permissionKeys: permissionsForRoleKey(roleKey),
    companyId: scope.companyId ?? null,
    brandId: scope.brandId ?? null,
    countryId: scope.countryId ?? null,
    departmentId: scope.departmentId ?? null,
    teamId: scope.teamId ?? null,
    moduleKey: scope.moduleKey ?? null,
    expiresAt: scope.expiresAt ?? null,
  };
}

export function principal(assignments: LoadedAssignment[], opts: { isSuperAdmin?: boolean; userId?: string } = {}): Principal {
  return { userId: opts.userId ?? "u_test", isSuperAdmin: opts.isSuperAdmin ?? false, assignments };
}

/** Custom-permission assignment (not tied to a seeded role). */
export function customAssignment(
  permissionKeys: string[],
  scope: Partial<Pick<LoadedAssignment, "companyId" | "brandId" | "countryId" | "departmentId" | "teamId" | "moduleKey" | "expiresAt">> = {},
): LoadedAssignment {
  return { ...assignment("__custom__", scope), permissionKeys: new Set(permissionKeys) };
}
