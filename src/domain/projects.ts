import { z } from "zod";
import type { Project } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { Principal } from "@/lib/permissions/engine";
import { listQuerySchema } from "@/lib/api/pagination";
import { scopedWhere } from "@/domain/scope";

export const projectQuerySchema = listQuerySchema.extend({ status: z.string().optional(), brandId: z.string().optional() });
export type ProjectQuery = z.infer<typeof projectQuerySchema>;

export async function listProjects(principal: Principal, query: ProjectQuery): Promise<{ rows: Project[]; total: number }> {
  const where: Record<string, unknown> = {
    archivedAt: null,
    ...scopedWhere(principal, "projects.view", ["companyId", "brandId"], {
      ...(query.status ? { status: query.status } : {}),
      ...(query.brandId ? { brandId: query.brandId } : {}),
      ...(query.q ? { OR: [{ name: { contains: query.q } }] } : {}),
    }),
  };
  const [rows, total] = await Promise.all([
    prisma.project.findMany({ where, orderBy: { updatedAt: "desc" }, skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
    prisma.project.count({ where }),
  ]);
  return { rows, total };
}
