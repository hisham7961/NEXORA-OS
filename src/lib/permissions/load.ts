import { prisma } from "@/lib/db";
import { DEFAULT_ROLES } from "./catalog";
import type { LoadedAssignment, Principal } from "./engine";

/**
 * Build a Principal from persisted role assignments. Role permission keys come
 * from RolePermission rows; the `*` wildcard (super_admin role) is preserved so
 * the engine can short-circuit. Cached per-request by the caller.
 */
export async function loadPrincipal(userId: string): Promise<Principal | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      roleAssignments: {
        include: { role: { include: { permissions: true } } },
      },
    },
  });
  if (!user || user.archivedAt || user.status !== "active") return null;

  const assignments: LoadedAssignment[] = user.roleAssignments.map((ra) => ({
    roleKey: ra.role.key,
    permissionKeys: new Set(ra.role.permissions.map((p) => p.permissionKey)),
    companyId: ra.companyId,
    brandId: ra.brandId,
    countryId: ra.countryId,
    departmentId: ra.departmentId,
    teamId: ra.teamId,
    moduleKey: ra.moduleKey,
    expiresAt: ra.expiresAt,
  }));

  return {
    userId: user.id,
    isSuperAdmin: user.isSuperAdmin,
    assignments,
  };
}

/** Fallback permission set for a role key not yet persisted (used in tests/seed). */
export function permissionsForRoleKey(roleKey: string): Set<string> {
  const def = DEFAULT_ROLES.find((r) => r.key === roleKey);
  return new Set(def?.permissions ?? []);
}
