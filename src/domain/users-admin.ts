import { z } from "zod";
import { prisma } from "@/lib/db";
import { getLookups, refName } from "@/domain/lookups";
import { listQuerySchema } from "@/lib/api/pagination";

/** Users administration (§3). */
export const userQuerySchema = listQuerySchema.extend({ status: z.string().optional() });
export type UserQuery = z.infer<typeof userQuerySchema>;

export async function listUsers(query: UserQuery) {
  const where: Record<string, unknown> = {
    archivedAt: null,
    ...(query.status ? { status: query.status } : {}),
    ...(query.q ? { OR: [{ name: { contains: query.q, mode: "insensitive" } }, { email: { contains: query.q, mode: "insensitive" } }] } : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { name: "asc" },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      include: { _count: { select: { roleAssignments: true } } },
    }),
    prisma.user.count({ where }),
  ]);
  return { rows, total };
}

export async function getUserAdmin(id: string) {
  const [user, roles, lookups] = await Promise.all([
    prisma.user.findUnique({ where: { id }, include: { employee: true, roleAssignments: { include: { role: true } } } }),
    prisma.role.findMany(),
    getLookups(),
  ]);
  if (!user) return null;
  const roleName = new Map(roles.map((r) => [r.id, r.name]));
  const assignments = user.roleAssignments.map((ra) => ({
    roleName: roleName.get(ra.roleId) ?? ra.roleId,
    company: ra.companyId ? refName(lookups.companies, ra.companyId) : "All",
    brand: ra.brandId ? refName(lookups.brands, ra.brandId) : "All",
    country: ra.countryId ? refName(lookups.countries, ra.countryId) : "All",
  }));
  return { user, assignments };
}
