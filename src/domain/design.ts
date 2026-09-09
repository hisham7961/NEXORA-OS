import { z } from "zod";
import type { DesignRequest } from "@prisma/client";
import { prisma } from "@/lib/db";
import { assertRecordInScope, type Principal } from "@/lib/permissions/engine";
import { listQuerySchema } from "@/lib/api/pagination";
import { scopedWhere, DIMS_CBC } from "@/domain/scope";

/** Creative / design requests (§12). */
export const designQuerySchema = listQuerySchema.extend({ status: z.string().optional(), brandId: z.string().optional() });
export type DesignQuery = z.infer<typeof designQuerySchema>;

export async function listDesign(principal: Principal, query: DesignQuery): Promise<{ rows: DesignRequest[]; total: number }> {
  const where: Record<string, unknown> = {
    archivedAt: null,
    ...scopedWhere(principal, "design.view", DIMS_CBC, {
      ...(query.status ? { status: query.status } : {}),
      ...(query.brandId ? { brandId: query.brandId } : {}),
      ...(query.q ? { OR: [{ assetType: { contains: query.q, mode: "insensitive" } }, { copy: { contains: query.q, mode: "insensitive" } }] } : {}),
    }),
  };
  const [rows, total] = await Promise.all([
    prisma.designRequest.findMany({ where, orderBy: { updatedAt: "desc" }, skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
    prisma.designRequest.count({ where }),
  ]);
  return { rows, total };
}

export async function getDesign(principal: Principal, id: string) {
  const req = await prisma.designRequest.findUnique({ where: { id }, include: { versions: { orderBy: { version: "desc" } } } });
  if (!req) return null;
  assertRecordInScope(principal, "design.view", { companyId: req.companyId, brandId: req.brandId, countryId: req.countryId }, DIMS_CBC);
  return req;
}
