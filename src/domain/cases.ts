import { z } from "zod";
import type { CustomerCase } from "@prisma/client";
import { prisma } from "@/lib/db";
import { assertRecordInScope, type Principal } from "@/lib/permissions/engine";
import { listQuerySchema } from "@/lib/api/pagination";
import { scopedWhere, DIMS_CBC } from "@/domain/scope";

/** Customer cases (§17). */
export const caseQuerySchema = listQuerySchema.extend({
  status: z.string().optional(),
  type: z.string().optional(),
  brandId: z.string().optional(),
});
export type CaseQuery = z.infer<typeof caseQuerySchema>;

export async function listCases(principal: Principal, query: CaseQuery): Promise<{ rows: CustomerCase[]; total: number }> {
  const where: Record<string, unknown> = {
    archivedAt: null,
    ...scopedWhere(principal, "cases.view", DIMS_CBC, {
      ...(query.status ? { status: query.status } : {}),
      ...(query.type ? { type: query.type } : {}),
      ...(query.brandId ? { brandId: query.brandId } : {}),
      ...(query.q ? { OR: [{ description: { contains: query.q, mode: "insensitive" } }, { customerRef: { contains: query.q, mode: "insensitive" } }] } : {}),
    }),
  };
  const [rows, total] = await Promise.all([
    prisma.customerCase.findMany({ where, orderBy: { updatedAt: "desc" }, skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
    prisma.customerCase.count({ where }),
  ]);
  return { rows, total };
}

export async function getCase(principal: Principal, id: string) {
  const c = await prisma.customerCase.findUnique({ where: { id }, include: { notes: { orderBy: { createdAt: "desc" } } } });
  if (!c) return null;
  assertRecordInScope(principal, "cases.view", { companyId: c.companyId, brandId: c.brandId, countryId: c.countryId }, DIMS_CBC);
  return c;
}
