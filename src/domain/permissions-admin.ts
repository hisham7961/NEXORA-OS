import { prisma } from "@/lib/db";
import { getLookups, refName } from "@/domain/lookups";
import { loadPrincipal } from "@/lib/permissions/load";
import { canAnywhere, type Principal } from "@/lib/permissions/engine";
import { MODULES, moduleForPermission } from "@/lib/permissions/catalog";

/** Does a role's permission-key set grant a specific key (with `*` and `manage` expansion)? */
function roleGrants(keys: Set<string>, permissionKey: string): boolean {
  if (keys.has("*")) return true;
  if (keys.has(permissionKey)) return true;
  return keys.has(`${moduleForPermission(permissionKey)}.manage`);
}

export interface MatrixRole {
  id: string;
  key: string;
  name: string;
  keys: Set<string>;
}

/** Roles × permissions matrix data (§3 Admin Permission Matrix). */
export async function getPermissionMatrix(): Promise<{ roles: MatrixRole[]; grants: (roleId: string, key: string) => boolean }> {
  const roles = await prisma.role.findMany({ include: { permissions: true }, orderBy: { name: "asc" } });
  const mapped: MatrixRole[] = roles.map((r) => ({ id: r.id, key: r.key, name: r.name, keys: new Set(r.permissions.map((p) => p.permissionKey)) }));
  const byId = new Map(mapped.map((r) => [r.id, r]));
  return {
    roles: mapped,
    grants: (roleId, key) => {
      const r = byId.get(roleId);
      return r ? roleGrants(r.keys, key) : false;
    },
  };
}

export interface TesterAssignment {
  roleName: string;
  company: string;
  brand: string;
  country: string;
  moduleKey: string;
}

export interface TesterModuleCap {
  module: string;
  label: string;
  group: string;
  actions: { action: string; can: boolean }[];
  anyAccess: boolean;
}

export interface TesterResult {
  user: { id: string; name: string; email: string; isSuperAdmin: boolean };
  assignments: TesterAssignment[];
  capabilities: TesterModuleCap[];
}

/** Permission Tester (§3): "What can this user access?" — computed from the real engine. */
export async function describeUserAccess(userId: string): Promise<TesterResult | null> {
  const [principal, user, roles, lookups] = await Promise.all([
    loadPrincipal(userId),
    prisma.user.findUnique({ where: { id: userId } }),
    prisma.role.findMany(),
    getLookups(),
  ]);
  if (!principal || !user) return null;

  const roleName = new Map(roles.map((r) => [r.key, r.name]));

  const assignments: TesterAssignment[] = principal.assignments.map((a) => ({
    roleName: roleName.get(a.roleKey) ?? a.roleKey,
    company: a.companyId ? refName(lookups.companies, a.companyId) : "All",
    brand: a.brandId ? refName(lookups.brands, a.brandId) : "All",
    country: a.countryId ? refName(lookups.countries, a.countryId) : "All",
    moduleKey: a.moduleKey ?? "All",
  }));

  const capabilities: TesterModuleCap[] = MODULES.map((m) => {
    const actions = m.actions.map((a) => ({ action: a, can: canAnywhere(principal as Principal, `${m.key}.${a}`) }));
    return { module: m.key, label: m.label, group: m.group, actions, anyAccess: actions.some((x) => x.can) };
  });

  return {
    user: { id: user.id, name: user.name, email: user.email, isSuperAdmin: user.isSuperAdmin },
    assignments,
    capabilities,
  };
}

export async function listSelectableUsers() {
  return prisma.user.findMany({ where: { archivedAt: null }, select: { id: true, name: true, email: true }, orderBy: { name: "asc" } });
}
