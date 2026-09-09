"use server";

import { revalidatePath } from "next/cache";
import { runAction, str, type ActionResult } from "@/lib/action";
import * as Org from "@/domain/org-admin";

const S = (fd: FormData, keys: string[]) => Object.fromEntries(keys.map((k) => [k, str(fd, k)]));

// ---- Companies ----
export async function createCompanyAction(_p: ActionResult | null, fd: FormData): Promise<ActionResult<{ id: string }>> {
  const res = await runAction(async (ctx) => ({ id: (await Org.createCompany(ctx, { ...S(fd, ["name", "legalName", "code", "baseCurrency", "hqCountryId", "timezone", "status"]), fiscalYearStartMonth: str(fd, "fiscalYearStartMonth") })).id }));
  if (res.ok) revalidatePath("/companies");
  return res;
}
export async function updateCompanyAction(_p: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const id = str(fd, "id")!;
  const res = await runAction((ctx) => Org.updateCompany(ctx, id, { ...S(fd, ["name", "legalName", "code", "baseCurrency", "hqCountryId", "timezone", "status"]), fiscalYearStartMonth: str(fd, "fiscalYearStartMonth") }));
  if (res.ok) { revalidatePath("/companies"); revalidatePath(`/companies/${id}`); }
  return res;
}
export async function archiveCompanyAction(id: string): Promise<ActionResult> {
  const res = await runAction((ctx) => Org.archiveCompany(ctx, id)); if (res.ok) revalidatePath("/companies"); return res;
}

// ---- Brands ----
export async function createBrandAction(_p: ActionResult | null, fd: FormData): Promise<ActionResult<{ id: string }>> {
  const res = await runAction(async (ctx) => ({ id: (await Org.createBrand(ctx, S(fd, ["name", "code", "slug", "description", "primaryCompanyId", "accentColor", "status"]))).id }));
  if (res.ok) revalidatePath("/brands");
  return res;
}
export async function updateBrandAction(_p: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const id = str(fd, "id")!;
  const res = await runAction((ctx) => Org.updateBrand(ctx, id, S(fd, ["name", "code", "slug", "description", "primaryCompanyId", "accentColor", "status"])));
  if (res.ok) { revalidatePath("/brands"); revalidatePath(`/brands/${id}`); }
  return res;
}
export async function archiveBrandAction(id: string): Promise<ActionResult> {
  const res = await runAction((ctx) => Org.archiveBrand(ctx, id)); if (res.ok) revalidatePath("/brands"); return res;
}

// ---- Countries / Markets ----
export async function createCountryAction(_p: ActionResult | null, fd: FormData): Promise<ActionResult<{ id: string }>> {
  const res = await runAction(async (ctx) => ({ id: (await Org.createCountry(ctx, { ...S(fd, ["name", "iso2", "iso3", "currency", "timezone", "region", "phoneCode"]), isActive: fd.get("isActive") ? "true" : "false" })).id }));
  if (res.ok) revalidatePath("/markets");
  return res;
}
export async function updateCountryAction(_p: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const id = str(fd, "id")!;
  const res = await runAction((ctx) => Org.updateCountry(ctx, id, { ...S(fd, ["name", "iso2", "iso3", "currency", "timezone", "region", "phoneCode"]), isActive: fd.get("isActive") ? "true" : "false" }));
  if (res.ok) { revalidatePath("/markets"); revalidatePath(`/markets/${id}`); }
  return res;
}

// ---- Departments ----
export async function createDepartmentAction(_p: ActionResult | null, fd: FormData): Promise<ActionResult<{ id: string }>> {
  const res = await runAction(async (ctx) => ({ id: (await Org.createDepartment(ctx, S(fd, ["name", "code", "companyId", "parentId", "description"]))).id }));
  if (res.ok) revalidatePath("/teams");
  return res;
}
export async function updateDepartmentAction(_p: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const id = str(fd, "id")!;
  const res = await runAction((ctx) => Org.updateDepartment(ctx, id, S(fd, ["name", "code", "companyId", "parentId", "description"])));
  if (res.ok) revalidatePath("/teams");
  return res;
}
export async function archiveDepartmentAction(id: string): Promise<ActionResult> {
  const res = await runAction((ctx) => Org.archiveDepartment(ctx, id)); if (res.ok) revalidatePath("/teams"); return res;
}

// ---- Teams ----
export async function createTeamAction(_p: ActionResult | null, fd: FormData): Promise<ActionResult<{ id: string }>> {
  const res = await runAction(async (ctx) => ({ id: (await Org.createTeam(ctx, S(fd, ["name", "departmentId", "brandId", "leadUserId", "description"]))).id }));
  if (res.ok) revalidatePath("/teams");
  return res;
}
export async function updateTeamAction(_p: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const id = str(fd, "id")!;
  const res = await runAction((ctx) => Org.updateTeam(ctx, id, S(fd, ["name", "departmentId", "brandId", "leadUserId", "description"])));
  if (res.ok) revalidatePath("/teams");
  return res;
}
export async function archiveTeamAction(id: string): Promise<ActionResult> {
  const res = await runAction((ctx) => Org.archiveTeam(ctx, id)); if (res.ok) revalidatePath("/teams"); return res;
}

// ---- Employees ----
export async function createEmployeeAction(_p: ActionResult | null, fd: FormData): Promise<ActionResult<{ id: string }>> {
  const res = await runAction(async (ctx) => ({ id: (await Org.createEmployee(ctx, S(fd, ["userId", "companyId", "departmentId", "teamId", "managerId", "position", "joinDate", "employmentStatus"]))).id }));
  if (res.ok) revalidatePath("/employees");
  return res;
}
export async function updateEmployeeAction(_p: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const id = str(fd, "id")!;
  const res = await runAction((ctx) => Org.updateEmployee(ctx, id, S(fd, ["companyId", "departmentId", "teamId", "managerId", "position", "joinDate", "employmentStatus"])));
  if (res.ok) { revalidatePath("/employees"); revalidatePath(`/employees/${id}`); }
  return res;
}
export async function archiveEmployeeAction(id: string): Promise<ActionResult> {
  const res = await runAction((ctx) => Org.archiveEmployee(ctx, id)); if (res.ok) revalidatePath("/employees"); return res;
}

// ---- Projects ----
export async function createProjectAction(_p: ActionResult | null, fd: FormData): Promise<ActionResult<{ id: string }>> {
  const res = await runAction(async (ctx) => ({ id: (await Org.createProject(ctx, S(fd, ["name", "brandId", "companyId", "ownerId", "status", "startDate", "dueDate", "description"]))).id }));
  if (res.ok) revalidatePath("/projects");
  return res;
}
export async function updateProjectAction(_p: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const id = str(fd, "id")!;
  const res = await runAction((ctx) => Org.updateProject(ctx, id, S(fd, ["name", "brandId", "companyId", "ownerId", "status", "startDate", "dueDate", "description"])));
  if (res.ok) { revalidatePath("/projects"); revalidatePath(`/projects/${id}`); }
  return res;
}
export async function archiveProjectAction(id: string): Promise<ActionResult> {
  const res = await runAction((ctx) => Org.archiveProject(ctx, id)); if (res.ok) revalidatePath("/projects"); return res;
}
