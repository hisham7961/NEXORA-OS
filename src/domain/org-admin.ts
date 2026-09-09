import { z } from "zod";
import { prisma } from "@/lib/db";
import { canAnywhere, ForbiddenError, type Principal } from "@/lib/permissions/engine";
import { ServiceError } from "@/lib/api/handler";
import { assertCan, audit, type ActorContext } from "@/domain/mutation";
import { optionalString, optionalDate } from "@/lib/validation";

/**
 * ORGANIZATION MASTER-DATA WRITE PATHS (§6, §61). Companies, brands, markets,
 * departments, teams, employees and projects were previously seed-only; this
 * gives them production CRUD (create / edit / archive) at the application layer,
 * gated by the relevant module permission and audited. Top-level entities
 * (companies, countries) are gated by module manage since they have no scope of
 * their own; scoped entities check the acting module permission.
 */

function assertManage(principal: Principal, key: string): void {
  if (!canAnywhere(principal, key)) throw new ForbiddenError(key);
}

const codeRe = /^[A-Za-z0-9_-]{1,24}$/;

// ---------------------------------------------------------------------------
// COMPANIES
// ---------------------------------------------------------------------------
export const companyInputSchema = z.object({
  name: z.string().trim().min(1).max(160),
  legalName: optionalString,
  code: z.string().trim().regex(codeRe, "Code must be short alphanumeric"),
  baseCurrency: z.preprocess((v) => (typeof v === "string" && v.trim() ? v.trim().toUpperCase() : undefined), z.string().length(3).default("KWD")),
  hqCountryId: optionalString,
  timezone: optionalString,
  fiscalYearStartMonth: z.preprocess((v) => (v == null || v === "" ? undefined : Number(v)), z.number().int().min(1).max(12).default(1)),
  status: optionalString,
});

export async function createCompany(ctx: ActorContext, raw: unknown) {
  assertManage(ctx.principal, "companies.create");
  const input = companyInputSchema.parse(raw);
  if (await prisma.company.findUnique({ where: { code: input.code } })) throw new ServiceError("code_taken", `Company code "${input.code}" is taken.`, 422);
  const company = await prisma.company.create({
    data: { name: input.name, legalName: input.legalName ?? null, code: input.code, baseCurrency: input.baseCurrency, hqCountryId: input.hqCountryId ?? null, timezone: input.timezone ?? "Asia/Kuwait", fiscalYearStartMonth: input.fiscalYearStartMonth, status: input.status ?? "active", createdById: ctx.principal.userId },
  });
  await audit(ctx, { action: "company.created", entityType: "Company", entityId: company.id, summary: `${input.name} (${input.code})`, companyId: company.id });
  return company;
}

export async function updateCompany(ctx: ActorContext, id: string, raw: unknown) {
  assertManage(ctx.principal, "companies.edit");
  const existing = await prisma.company.findUnique({ where: { id } });
  if (!existing || existing.archivedAt) throw new ServiceError("not_found", "Company not found", 404);
  const input = companyInputSchema.partial().parse(raw);
  if (input.code && input.code !== existing.code && (await prisma.company.findUnique({ where: { code: input.code } }))) throw new ServiceError("code_taken", `Company code "${input.code}" is taken.`, 422);
  const data: Record<string, unknown> = {};
  for (const k of ["name", "legalName", "code", "baseCurrency", "hqCountryId", "timezone", "status"] as const) if (input[k] !== undefined) data[k] = input[k] ?? null;
  if (input.fiscalYearStartMonth !== undefined) data.fiscalYearStartMonth = input.fiscalYearStartMonth;
  const company = await prisma.company.update({ where: { id }, data });
  await audit(ctx, { action: "company.updated", entityType: "Company", entityId: id, summary: company.name, companyId: id });
  return company;
}

export async function archiveCompany(ctx: ActorContext, id: string) {
  assertManage(ctx.principal, "companies.delete");
  const c = await prisma.company.findUnique({ where: { id } });
  if (!c) throw new ServiceError("not_found", "Company not found", 404);
  await prisma.company.update({ where: { id }, data: { archivedAt: new Date(), status: "archived" } });
  await audit(ctx, { action: "company.archived", entityType: "Company", entityId: id, summary: c.name, companyId: id });
}

// ---------------------------------------------------------------------------
// BRANDS
// ---------------------------------------------------------------------------
export const brandInputSchema = z.object({
  name: z.string().trim().min(1).max(160),
  code: z.string().trim().regex(codeRe, "Code must be short alphanumeric"),
  slug: z.string().trim().regex(/^[a-z0-9-]{1,40}$/, "Slug must be lower kebab-case"),
  description: optionalString,
  primaryCompanyId: optionalString,
  accentColor: optionalString,
  status: optionalString,
});

export async function createBrand(ctx: ActorContext, raw: unknown) {
  assertManage(ctx.principal, "brands.create");
  const input = brandInputSchema.parse(raw);
  if (await prisma.brand.findUnique({ where: { code: input.code } })) throw new ServiceError("code_taken", `Brand code "${input.code}" is taken.`, 422);
  if (await prisma.brand.findUnique({ where: { slug: input.slug } })) throw new ServiceError("slug_taken", `Brand slug "${input.slug}" is taken.`, 422);
  const brand = await prisma.$transaction(async (tx) => {
    const b = await tx.brand.create({ data: { name: input.name, code: input.code, slug: input.slug, description: input.description ?? null, primaryCompanyId: input.primaryCompanyId ?? null, accentColor: input.accentColor ?? null, status: input.status ?? "active", createdById: ctx.principal.userId } });
    if (input.primaryCompanyId) await tx.brandCompany.create({ data: { brandId: b.id, companyId: input.primaryCompanyId } }).catch(() => {});
    return b;
  });
  await audit(ctx, { action: "brand.created", entityType: "Brand", entityId: brand.id, summary: `${input.name} (${input.code})`, brandId: brand.id });
  return brand;
}

export async function updateBrand(ctx: ActorContext, id: string, raw: unknown) {
  assertManage(ctx.principal, "brands.edit");
  const existing = await prisma.brand.findUnique({ where: { id } });
  if (!existing || existing.archivedAt) throw new ServiceError("not_found", "Brand not found", 404);
  const input = brandInputSchema.partial().parse(raw);
  if (input.code && input.code !== existing.code && (await prisma.brand.findUnique({ where: { code: input.code } }))) throw new ServiceError("code_taken", "Brand code is taken.", 422);
  if (input.slug && input.slug !== existing.slug && (await prisma.brand.findUnique({ where: { slug: input.slug } }))) throw new ServiceError("slug_taken", "Brand slug is taken.", 422);
  const data: Record<string, unknown> = {};
  for (const k of ["name", "code", "slug", "description", "primaryCompanyId", "accentColor", "status"] as const) if (input[k] !== undefined) data[k] = input[k] ?? null;
  const brand = await prisma.brand.update({ where: { id }, data });
  await audit(ctx, { action: "brand.updated", entityType: "Brand", entityId: id, summary: brand.name, brandId: id });
  return brand;
}

export async function archiveBrand(ctx: ActorContext, id: string) {
  assertManage(ctx.principal, "brands.delete");
  const b = await prisma.brand.findUnique({ where: { id } });
  if (!b) throw new ServiceError("not_found", "Brand not found", 404);
  await prisma.brand.update({ where: { id }, data: { archivedAt: new Date(), status: "archived" } });
  await audit(ctx, { action: "brand.archived", entityType: "Brand", entityId: id, summary: b.name, brandId: id });
}

// ---------------------------------------------------------------------------
// COUNTRIES / MARKETS
// ---------------------------------------------------------------------------
export const countryInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  iso2: z.string().trim().length(2).transform((s) => s.toUpperCase()),
  iso3: optionalString,
  currency: z.preprocess((v) => (typeof v === "string" && v.trim() ? v.trim().toUpperCase() : undefined), z.string().length(3)),
  timezone: optionalString,
  region: optionalString,
  phoneCode: optionalString,
  isActive: z.preprocess((v) => (v === undefined ? undefined : v === "true" || v === true || v === "on"), z.boolean().default(true)),
});

export async function createCountry(ctx: ActorContext, raw: unknown) {
  assertManage(ctx.principal, "markets.create");
  const input = countryInputSchema.parse(raw);
  if (await prisma.country.findUnique({ where: { iso2: input.iso2 } })) throw new ServiceError("iso_taken", `ISO code "${input.iso2}" already exists.`, 422);
  const country = await prisma.country.create({ data: { name: input.name, iso2: input.iso2, iso3: input.iso3 ?? null, currency: input.currency, timezone: input.timezone ?? "Asia/Kuwait", region: input.region ?? null, phoneCode: input.phoneCode ?? null, isActive: input.isActive } });
  await audit(ctx, { action: "country.created", entityType: "Country", entityId: country.id, summary: `${input.name} (${input.iso2})` });
  return country;
}

export async function updateCountry(ctx: ActorContext, id: string, raw: unknown) {
  assertManage(ctx.principal, "markets.edit");
  const existing = await prisma.country.findUnique({ where: { id } });
  if (!existing) throw new ServiceError("not_found", "Country not found", 404);
  const input = countryInputSchema.partial().parse(raw);
  if (input.iso2 && input.iso2 !== existing.iso2 && (await prisma.country.findUnique({ where: { iso2: input.iso2 } }))) throw new ServiceError("iso_taken", "ISO code is taken.", 422);
  const data: Record<string, unknown> = {};
  for (const k of ["name", "iso2", "iso3", "currency", "timezone", "region", "phoneCode"] as const) if (input[k] !== undefined) data[k] = input[k] ?? null;
  if (input.isActive !== undefined) data.isActive = input.isActive;
  const country = await prisma.country.update({ where: { id }, data });
  await audit(ctx, { action: "country.updated", entityType: "Country", entityId: id, summary: country.name });
  return country;
}

// ---------------------------------------------------------------------------
// DEPARTMENTS (gated under teams management — org structure)
// ---------------------------------------------------------------------------
export const departmentInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  code: optionalString,
  companyId: optionalString,
  parentId: optionalString,
  description: optionalString,
});

export async function createDepartment(ctx: ActorContext, raw: unknown) {
  assertManage(ctx.principal, "teams.create");
  const input = departmentInputSchema.parse(raw);
  const dep = await prisma.department.create({ data: { name: input.name, code: input.code ?? null, companyId: input.companyId ?? null, parentId: input.parentId ?? null, description: input.description ?? null } });
  await audit(ctx, { action: "department.created", entityType: "Department", entityId: dep.id, summary: input.name, companyId: dep.companyId });
  return dep;
}

export async function updateDepartment(ctx: ActorContext, id: string, raw: unknown) {
  assertManage(ctx.principal, "teams.edit");
  if (!(await prisma.department.findUnique({ where: { id } }))) throw new ServiceError("not_found", "Department not found", 404);
  const input = departmentInputSchema.partial().parse(raw);
  const data: Record<string, unknown> = {};
  for (const k of ["name", "code", "companyId", "parentId", "description"] as const) if (input[k] !== undefined) data[k] = input[k] ?? null;
  const dep = await prisma.department.update({ where: { id }, data });
  await audit(ctx, { action: "department.updated", entityType: "Department", entityId: id, summary: dep.name, companyId: dep.companyId });
  return dep;
}

export async function archiveDepartment(ctx: ActorContext, id: string) {
  assertManage(ctx.principal, "teams.delete");
  const dep = await prisma.department.findUnique({ where: { id } });
  if (!dep) throw new ServiceError("not_found", "Department not found", 404);
  await prisma.department.update({ where: { id }, data: { archivedAt: new Date() } });
  await audit(ctx, { action: "department.archived", entityType: "Department", entityId: id, summary: dep.name, companyId: dep.companyId });
}

// ---------------------------------------------------------------------------
// TEAMS
// ---------------------------------------------------------------------------
export const teamInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  departmentId: optionalString,
  brandId: optionalString,
  leadUserId: optionalString,
  description: optionalString,
});

export async function createTeam(ctx: ActorContext, raw: unknown) {
  const input = teamInputSchema.parse(raw);
  assertCan(ctx.principal, "teams.create", { brandId: input.brandId ?? null });
  const team = await prisma.team.create({ data: { name: input.name, departmentId: input.departmentId ?? null, brandId: input.brandId ?? null, leadUserId: input.leadUserId ?? null, description: input.description ?? null } });
  await audit(ctx, { action: "team.created", entityType: "Team", entityId: team.id, summary: input.name, brandId: team.brandId });
  return team;
}

export async function updateTeam(ctx: ActorContext, id: string, raw: unknown) {
  const existing = await prisma.team.findUnique({ where: { id } });
  if (!existing || existing.archivedAt) throw new ServiceError("not_found", "Team not found", 404);
  assertCan(ctx.principal, "teams.edit", { brandId: existing.brandId });
  const input = teamInputSchema.partial().parse(raw);
  const data: Record<string, unknown> = {};
  for (const k of ["name", "departmentId", "brandId", "leadUserId", "description"] as const) if (input[k] !== undefined) data[k] = input[k] ?? null;
  const team = await prisma.team.update({ where: { id }, data });
  await audit(ctx, { action: "team.updated", entityType: "Team", entityId: id, summary: team.name, brandId: team.brandId });
  return team;
}

export async function archiveTeam(ctx: ActorContext, id: string) {
  const t = await prisma.team.findUnique({ where: { id } });
  if (!t) throw new ServiceError("not_found", "Team not found", 404);
  assertCan(ctx.principal, "teams.delete", { brandId: t.brandId });
  await prisma.team.update({ where: { id }, data: { archivedAt: new Date() } });
  await audit(ctx, { action: "team.archived", entityType: "Team", entityId: id, summary: t.name, brandId: t.brandId });
}

// ---------------------------------------------------------------------------
// EMPLOYEES (profile of an existing user)
// ---------------------------------------------------------------------------
export const employeeInputSchema = z.object({
  userId: z.string().min(1),
  companyId: optionalString,
  departmentId: optionalString,
  teamId: optionalString,
  managerId: optionalString,
  position: optionalString,
  joinDate: optionalDate,
  employmentStatus: optionalString,
});

export async function createEmployee(ctx: ActorContext, raw: unknown) {
  assertManage(ctx.principal, "employees.create");
  const input = employeeInputSchema.parse(raw);
  if (await prisma.employee.findUnique({ where: { userId: input.userId } })) throw new ServiceError("exists", "This user already has an employee profile.", 422);
  const emp = await prisma.employee.create({ data: { userId: input.userId, companyId: input.companyId ?? null, departmentId: input.departmentId ?? null, teamId: input.teamId ?? null, managerId: input.managerId ?? null, position: input.position ?? null, joinDate: input.joinDate ?? null, employmentStatus: input.employmentStatus ?? "active" } });
  await audit(ctx, { action: "employee.created", entityType: "Employee", entityId: emp.id, summary: input.position ?? "Employee profile", companyId: emp.companyId });
  return emp;
}

export async function updateEmployee(ctx: ActorContext, id: string, raw: unknown) {
  assertManage(ctx.principal, "employees.edit");
  const existing = await prisma.employee.findUnique({ where: { id } });
  if (!existing || existing.archivedAt) throw new ServiceError("not_found", "Employee not found", 404);
  const input = employeeInputSchema.partial().omit({ userId: true }).parse(raw);
  const data: Record<string, unknown> = {};
  for (const k of ["companyId", "departmentId", "teamId", "managerId", "position", "employmentStatus"] as const) if (input[k] !== undefined) data[k] = input[k] ?? null;
  if (input.joinDate !== undefined) data.joinDate = input.joinDate ?? null;
  const emp = await prisma.employee.update({ where: { id }, data });
  await audit(ctx, { action: "employee.updated", entityType: "Employee", entityId: id, summary: emp.position ?? "Employee profile", companyId: emp.companyId });
  return emp;
}

export async function archiveEmployee(ctx: ActorContext, id: string) {
  assertManage(ctx.principal, "employees.delete");
  const e = await prisma.employee.findUnique({ where: { id } });
  if (!e) throw new ServiceError("not_found", "Employee not found", 404);
  await prisma.employee.update({ where: { id }, data: { archivedAt: new Date(), employmentStatus: "offboarded" } });
  await audit(ctx, { action: "employee.archived", entityType: "Employee", entityId: id, summary: "Offboarded", companyId: e.companyId });
}

// ---------------------------------------------------------------------------
// PROJECTS
// ---------------------------------------------------------------------------
export const projectInputSchema = z.object({
  name: z.string().trim().min(1).max(160),
  brandId: optionalString,
  companyId: optionalString,
  ownerId: optionalString,
  status: optionalString,
  startDate: optionalDate,
  dueDate: optionalDate,
  description: optionalString,
});

export async function createProject(ctx: ActorContext, raw: unknown) {
  const input = projectInputSchema.parse(raw);
  assertCan(ctx.principal, "projects.create", { brandId: input.brandId ?? null, companyId: input.companyId ?? null });
  const project = await prisma.project.create({ data: { name: input.name, brandId: input.brandId ?? null, companyId: input.companyId ?? null, ownerId: input.ownerId ?? ctx.principal.userId, status: input.status ?? "active", startDate: input.startDate ?? null, dueDate: input.dueDate ?? null, description: input.description ?? null } });
  await audit(ctx, { action: "project.created", entityType: "Project", entityId: project.id, summary: input.name, brandId: project.brandId, companyId: project.companyId });
  return project;
}

export async function updateProject(ctx: ActorContext, id: string, raw: unknown) {
  const existing = await prisma.project.findUnique({ where: { id } });
  if (!existing || existing.archivedAt) throw new ServiceError("not_found", "Project not found", 404);
  assertCan(ctx.principal, "projects.edit", { brandId: existing.brandId, companyId: existing.companyId });
  const input = projectInputSchema.partial().parse(raw);
  const data: Record<string, unknown> = {};
  for (const k of ["name", "brandId", "companyId", "ownerId", "status", "description"] as const) if (input[k] !== undefined) data[k] = input[k] ?? null;
  if (input.startDate !== undefined) data.startDate = input.startDate ?? null;
  if (input.dueDate !== undefined) data.dueDate = input.dueDate ?? null;
  const project = await prisma.project.update({ where: { id }, data });
  await audit(ctx, { action: "project.updated", entityType: "Project", entityId: id, summary: project.name, brandId: project.brandId, companyId: project.companyId });
  return project;
}

export async function archiveProject(ctx: ActorContext, id: string) {
  const p = await prisma.project.findUnique({ where: { id } });
  if (!p) throw new ServiceError("not_found", "Project not found", 404);
  assertCan(ctx.principal, "projects.delete", { brandId: p.brandId, companyId: p.companyId });
  await prisma.project.update({ where: { id }, data: { archivedAt: new Date(), status: "archived" } });
  await audit(ctx, { action: "project.archived", entityType: "Project", entityId: id, summary: p.name, brandId: p.brandId, companyId: p.companyId });
}
