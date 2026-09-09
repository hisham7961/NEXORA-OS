import { z } from "zod";
import { prisma } from "@/lib/db";
import { getLookups, refName } from "@/domain/lookups";
import { loadPrincipal } from "@/lib/permissions/load";
import { can, canAnywhere, ForbiddenError, type Principal } from "@/lib/permissions/engine";
import { MODULES, moduleForPermission, allPermissionKeys, SPECIAL_PERMISSIONS } from "@/lib/permissions/catalog";
import { ServiceError } from "@/lib/api/handler";
import { assertCan, audit, type ActorContext } from "@/domain/mutation";
import { requiredString, optionalString, optionalDate } from "@/lib/validation";

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

// ---------------------------------------------------------------------------
// PERMISSION ADMINISTRATION (§3, Phase 2 Part X) — roles + scoped assignments,
// all audited. Non-super-admins can never grant a scope broader than their own
// administration authority, nor assign the super-admin role.
// ---------------------------------------------------------------------------

const VALID_PERMISSIONS = new Set([...allPermissionKeys(), ...SPECIAL_PERMISSIONS]);

export const roleInputSchema = z.object({
  key: z.string().regex(/^[a-z0-9_]+$/, "Use lowercase letters, digits and underscores").min(2).max(40),
  name: requiredString(60),
  description: optionalString,
  permissions: z.array(z.string()).default([]),
});

export async function createRole(ctx: ActorContext, raw: unknown) {
  assertCan(ctx.principal, "permissions.manage");
  const input = roleInputSchema.parse(raw);
  const perms = [...new Set(input.permissions)].filter((p) => VALID_PERMISSIONS.has(p));
  const existing = await prisma.role.findUnique({ where: { key: input.key } });
  if (existing) throw new ServiceError("duplicate", "A role with that key already exists", 409);
  const role = await prisma.$transaction(async (tx) => {
    const r = await tx.role.create({ data: { key: input.key, name: input.name, description: input.description ?? null, isSystem: false } });
    if (perms.length) await tx.rolePermission.createMany({ data: perms.map((permissionKey) => ({ roleId: r.id, permissionKey })) });
    return r;
  });
  await audit(ctx, { action: "permission.role_created", entityType: "Role", entityId: role.id, summary: input.name, newValues: { key: input.key, permissions: perms.length } });
  return role;
}

export const roleUpdateSchema = roleInputSchema.omit({ key: true }).partial();

export async function updateRole(ctx: ActorContext, roleId: string, raw: unknown) {
  assertCan(ctx.principal, "permissions.manage");
  const role = await prisma.role.findUnique({ where: { id: roleId } });
  if (!role) throw new ServiceError("not_found", "Role not found", 404);
  if (role.key === "super_admin") throw new ServiceError("protected", "The Super Administrator role cannot be edited.", 403);
  const input = roleUpdateSchema.parse(raw);

  await prisma.$transaction(async (tx) => {
    await tx.role.update({ where: { id: roleId }, data: { ...(input.name ? { name: input.name } : {}), ...(input.description !== undefined ? { description: input.description ?? null } : {}) } });
    if (input.permissions) {
      const perms = [...new Set(input.permissions)].filter((p) => VALID_PERMISSIONS.has(p));
      await tx.rolePermission.deleteMany({ where: { roleId } });
      if (perms.length) await tx.rolePermission.createMany({ data: perms.map((permissionKey) => ({ roleId, permissionKey })) });
    }
  });
  await audit(ctx, { action: "permission.role_updated", entityType: "Role", entityId: roleId, summary: role.name, newValues: input.permissions ? { permissions: input.permissions.length } : input });
}

export const assignmentInputSchema = z.object({
  userId: z.string().min(1),
  roleId: z.string().min(1),
  companyId: optionalString,
  brandId: optionalString,
  countryId: optionalString,
  departmentId: optionalString,
  teamId: optionalString,
  moduleKey: optionalString,
  expiresAt: optionalDate,
});

export async function assignRole(ctx: ActorContext, raw: unknown) {
  const input = assignmentInputSchema.parse(raw);
  const role = await prisma.role.findUnique({ where: { id: input.roleId } });
  if (!role) throw new ServiceError("not_found", "Role not found", 404);
  // No escalation: only a super admin may grant the super-admin role.
  if (role.key === "super_admin" && !ctx.principal.isSuperAdmin) throw new ForbiddenError("permissions.grant_super_admin");

  // No escalation: the granter must have permissions.manage WITHIN the target scope.
  const targetScope = { companyId: input.companyId ?? null, brandId: input.brandId ?? null, countryId: input.countryId ?? null, departmentId: input.departmentId ?? null, teamId: input.teamId ?? null };
  if (!can(ctx.principal, "permissions.manage", targetScope)) throw new ForbiddenError("permissions.manage");

  const assignment = await prisma.roleAssignment.create({
    data: { userId: input.userId, roleId: input.roleId, ...targetScope, moduleKey: input.moduleKey ?? null, grantedById: ctx.principal.userId, expiresAt: input.expiresAt ?? null },
  });
  await audit(ctx, { action: "permission.assigned", entityType: "User", entityId: input.userId, summary: `Granted ${role.name}`, brandId: input.brandId ?? null, companyId: input.companyId ?? null, newValues: { role: role.key, ...targetScope } });
  return assignment;
}

export async function removeAssignment(ctx: ActorContext, assignmentId: string) {
  const a = await prisma.roleAssignment.findUnique({ where: { id: assignmentId }, include: { role: true } });
  if (!a) throw new ServiceError("not_found", "Assignment not found", 404);
  const scope = { companyId: a.companyId, brandId: a.brandId, countryId: a.countryId, departmentId: a.departmentId, teamId: a.teamId };
  if (!can(ctx.principal, "permissions.manage", scope)) throw new ForbiddenError("permissions.manage");
  await prisma.roleAssignment.delete({ where: { id: assignmentId } });
  await audit(ctx, { action: "permission.unassigned", entityType: "User", entityId: a.userId, summary: `Revoked ${a.role.name}`, brandId: a.brandId, companyId: a.companyId, oldValues: { role: a.role.key, ...scope } });
}

/** All roles with their permission keys (for the Roles admin tab). */
export async function listRolesFull() {
  const roles = await prisma.role.findMany({ include: { permissions: true, _count: { select: { assignments: true } } }, orderBy: { name: "asc" } });
  return roles.map((r) => ({ id: r.id, key: r.key, name: r.name, description: r.description, isSystem: r.isSystem, assignments: r._count.assignments, permissions: r.permissions.map((p) => p.permissionKey) }));
}

/** All assignments with resolved names (for the Assignments admin tab). */
export async function listAssignments() {
  const [assignments, roles, lookups] = await Promise.all([
    prisma.roleAssignment.findMany({ orderBy: { createdAt: "desc" }, take: 500 }),
    prisma.role.findMany(),
    getLookups(),
  ]);
  const roleName = new Map(roles.map((r) => [r.id, r.name]));
  return assignments.map((a) => ({
    id: a.id,
    userName: refName(lookups.users, a.userId),
    userColor: lookups.users.get(a.userId)?.meta ?? null,
    roleName: roleName.get(a.roleId) ?? a.roleId,
    company: a.companyId ? refName(lookups.companies, a.companyId) : "All",
    brand: a.brandId ? refName(lookups.brands, a.brandId) : "All",
    country: a.countryId ? refName(lookups.countries, a.countryId) : "All",
    expiresAt: a.expiresAt,
  }));
}
