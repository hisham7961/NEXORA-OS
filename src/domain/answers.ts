import { z } from "zod";
import type { ApprovedAnswer } from "@prisma/client";
import { prisma } from "@/lib/db";
import { accessibleScopeIds, type Principal } from "@/lib/permissions/engine";
import { listQuerySchema } from "@/lib/api/pagination";

/** Approved Answer Library (§18). Scoped by brand (records may be brand-null = global). */
export const answerQuerySchema = listQuerySchema.extend({
  status: z.string().optional(),
  category: z.string().optional(),
  language: z.string().optional(),
  brandId: z.string().optional(),
});
export type AnswerQuery = z.infer<typeof answerQuerySchema>;

export async function listAnswers(principal: Principal, query: AnswerQuery): Promise<{ rows: ApprovedAnswer[]; total: number }> {
  const ids = accessibleScopeIds(principal, "answers.view", "brandId");
  const where: Record<string, unknown> = {
    archivedAt: null,
    // brand-null answers are group-wide and visible to any answers viewer.
    ...(ids === "all" ? {} : { OR: [{ brandId: null }, { brandId: { in: ids } }] }),
    ...(query.status ? { status: query.status } : {}),
    ...(query.category ? { category: query.category } : {}),
    ...(query.language ? { language: query.language } : {}),
    ...(query.brandId ? { brandId: query.brandId } : {}),
    ...(query.q ? { question: { contains: query.q } } : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.approvedAnswer.findMany({ where, orderBy: { updatedAt: "desc" }, skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
    prisma.approvedAnswer.count({ where }),
  ]);
  return { rows, total };
}
