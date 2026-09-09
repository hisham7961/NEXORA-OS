import { prisma } from "@/lib/db";
import { accessibleScopeIds, type Principal } from "@/lib/permissions/engine";

export interface Option {
  id: string;
  label: string;
  meta?: string | null;
}

/**
 * Scoped select options for create/edit forms (Phase 2, Part F). Brands and
 * countries are limited to what the principal may act within for the given
 * permission, so a scoped user can only reference entities inside their scope.
 */
export async function getScopedOptions(principal: Principal, permission: string) {
  const brandIds = accessibleScopeIds(principal, permission, "brandId");
  const countryIds = accessibleScopeIds(principal, permission, "countryId");
  const companyIds = accessibleScopeIds(principal, permission, "companyId");

  const [brands, countries, companies, users, projects] = await Promise.all([
    prisma.brand.findMany({
      where: { archivedAt: null, ...(brandIds === "all" ? {} : { id: { in: brandIds } }) },
      select: { id: true, name: true, accentColor: true },
      orderBy: { name: "asc" },
    }),
    prisma.country.findMany({
      where: countryIds === "all" ? {} : { id: { in: countryIds } },
      select: { id: true, name: true, iso2: true },
      orderBy: { name: "asc" },
    }),
    prisma.company.findMany({
      where: { archivedAt: null, ...(companyIds === "all" ? {} : { id: { in: companyIds } }) },
      select: { id: true, name: true, code: true },
      orderBy: { name: "asc" },
    }),
    prisma.user.findMany({ where: { archivedAt: null, status: "active" }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.project.findMany({ where: { archivedAt: null }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  return {
    brands: brands.map((b) => ({ id: b.id, label: b.name, meta: b.accentColor })) as Option[],
    countries: countries.map((c) => ({ id: c.id, label: c.name, meta: c.iso2 })) as Option[],
    companies: companies.map((c) => ({ id: c.id, label: c.name, meta: c.code })) as Option[],
    users: users.map((u) => ({ id: u.id, label: u.name })) as Option[],
    projects: projects.map((p) => ({ id: p.id, label: p.name })) as Option[],
  };
}
