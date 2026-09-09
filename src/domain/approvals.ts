import { z } from "zod";
import type { ApprovalRequest } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { Principal } from "@/lib/permissions/engine";
import { listQuerySchema } from "@/lib/api/pagination";
import { scopedWhere } from "@/domain/scope";

/** Approval Center (§24). */
export const approvalQuerySchema = listQuerySchema.extend({ status: z.string().optional(), type: z.string().optional() });
export type ApprovalQuery = z.infer<typeof approvalQuerySchema>;

export async function listApprovals(principal: Principal, query: ApprovalQuery): Promise<{ rows: ApprovalRequest[]; total: number }> {
  const where: Record<string, unknown> = {
    archivedAt: null,
    ...scopedWhere(principal, "approvals.view", ["companyId", "brandId"], {
      ...(query.status ? { status: query.status } : {}),
      ...(query.type ? { type: query.type } : {}),
      ...(query.q ? { OR: [{ title: { contains: query.q } }] } : {}),
    }),
  };
  const [rows, total] = await Promise.all([
    prisma.approvalRequest.findMany({ where, orderBy: { updatedAt: "desc" }, skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
    prisma.approvalRequest.count({ where }),
  ]);
  return { rows, total };
}

/** Items awaiting the current user's decision ("Waiting for me"). */
export async function getMyApprovals(principal: Principal) {
  const steps = await prisma.approvalStep.findMany({
    where: { approverUserId: principal.userId, status: "pending", request: { status: "pending" } },
    include: { request: true },
    orderBy: { id: "desc" },
    take: 50,
  });
  return steps;
}

export async function getApproval(id: string) {
  return prisma.approvalRequest.findUnique({ where: { id }, include: { steps: { orderBy: { order: "asc" } } } });
}
