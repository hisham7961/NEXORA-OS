import { z } from "zod";
import type { KnowledgeArticle } from "@prisma/client";
import { prisma } from "@/lib/db";
import { accessibleScopeIds, type Principal } from "@/lib/permissions/engine";
import { listQuerySchema } from "@/lib/api/pagination";

/** Internal Knowledge Base (§19). */
export const knowledgeQuerySchema = listQuerySchema.extend({ category: z.string().optional(), status: z.string().optional() });
export type KnowledgeQuery = z.infer<typeof knowledgeQuerySchema>;

export async function listKnowledge(principal: Principal, query: KnowledgeQuery): Promise<{ rows: KnowledgeArticle[]; total: number }> {
  const ids = accessibleScopeIds(principal, "knowledge.view", "brandId");
  const where: Record<string, unknown> = {
    archivedAt: null,
    ...(ids === "all" ? {} : { OR: [{ brandId: null }, { brandId: { in: ids } }] }),
    ...(query.category ? { category: query.category } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.q ? { title: { contains: query.q, mode: "insensitive" } } : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.knowledgeArticle.findMany({ where, orderBy: { updatedAt: "desc" }, skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
    prisma.knowledgeArticle.count({ where }),
  ]);
  return { rows, total };
}
