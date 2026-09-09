import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertRecordInScope, type Principal } from "@/lib/permissions/engine";
import { listQuerySchema } from "@/lib/api/pagination";
import { scopedWhere } from "@/domain/scope";
import type { ScopeDimension } from "@/lib/permissions/catalog";

/** Employee records carry only companyId as a scope dimension (brands/countries via assignments). */
const DIMS_EMPLOYEE: ScopeDimension[] = ["companyId"];

/** Employees list query = base list params + module-specific filters. */
export const employeeQuerySchema = listQuerySchema.extend({ status: z.string().optional() });
export type EmployeeQuery = z.infer<typeof employeeQuerySchema>;

export interface EmployeeRow {
  id: string;
  userId: string;
  name: string;
  avatarColor: string | null;
  position: string | null;
  companyId: string | null;
  departmentId: string | null;
  departmentName: string | null;
  status: string;
}

export async function listEmployees(principal: Principal, query: EmployeeQuery): Promise<{ rows: EmployeeRow[]; total: number }> {
  const where: Record<string, unknown> = {
    archivedAt: null,
    ...scopedWhere(principal, "employees.view", DIMS_EMPLOYEE, {
      ...(query.status ? { employmentStatus: query.status } : {}),
      ...(query.q ? { OR: [{ position: { contains: query.q } }, { user: { name: { contains: query.q } } }] } : {}),
    }),
  };

  const [employees, total] = await Promise.all([
    prisma.employee.findMany({
      where,
      include: { user: true },
      orderBy: { updatedAt: "desc" },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.employee.count({ where }),
  ]);

  // Departments are not part of the shared lookups set; resolve names once.
  const deptIds = [...new Set(employees.map((e) => e.departmentId).filter((d): d is string => !!d))];
  const depts = deptIds.length
    ? await prisma.department.findMany({ where: { id: { in: deptIds } }, select: { id: true, name: true } })
    : [];
  const deptMap = new Map(depts.map((d) => [d.id, d.name]));

  return {
    rows: employees.map((e) => ({
      id: e.id,
      userId: e.userId,
      name: e.user.name,
      avatarColor: e.user.avatarColor,
      position: e.position,
      companyId: e.companyId,
      departmentId: e.departmentId,
      departmentName: e.departmentId ? deptMap.get(e.departmentId) ?? null : null,
      status: e.employmentStatus,
    })),
    total,
  };
}

export async function getEmployee(principal: Principal, id: string) {
  const employee = await prisma.employee.findUnique({
    where: { id },
    include: { user: true, brandAssignments: true, countryAssignments: true },
  });
  if (!employee) return null;
  // Fail-closed scope guard (§69): a company-scoped user cannot open another company's employee.
  assertRecordInScope(principal, "employees.view", { companyId: employee.companyId }, DIMS_EMPLOYEE);

  const [openTasks, department] = await Promise.all([
    prisma.task.count({
      where: { ownerId: employee.userId, archivedAt: null, status: { notIn: ["completed", "cancelled"] } },
    }),
    employee.departmentId
      ? prisma.department.findUnique({ where: { id: employee.departmentId }, select: { name: true } })
      : Promise.resolve(null),
  ]);

  return { employee, openTasks, departmentName: department?.name ?? null };
}
