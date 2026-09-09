import { z } from "zod";
import type { Subscription } from "@prisma/client";
import { prisma } from "@/lib/db";
import { type Principal } from "@/lib/permissions/engine";
import { listQuerySchema } from "@/lib/api/pagination";
import { scopedWhere, DIMS_CBC } from "@/domain/scope";

/** Subscriptions & services (§25). `filter=renewing` = due within 30 days. */
export const subscriptionQuerySchema = listQuerySchema.extend({ status: z.string().optional(), filter: z.string().optional() });
export type SubscriptionQuery = z.infer<typeof subscriptionQuerySchema>;

export async function listSubscriptions(principal: Principal, query: SubscriptionQuery): Promise<{ rows: Subscription[]; total: number }> {
  const in30 = new Date(Date.now() + 30 * 86_400_000);
  const extra: Record<string, unknown> = {
    ...(query.status ? { status: query.status } : {}),
    ...(query.q ? { OR: [{ provider: { contains: query.q } }] } : {}),
    ...(query.filter === "renewing" ? { renewalDate: { lte: in30 }, status: { not: "cancelled" } } : {}),
  };
  const where: Record<string, unknown> = { archivedAt: null, ...scopedWhere(principal, "subscriptions.view", DIMS_CBC, extra) };
  const [rows, total] = await Promise.all([
    prisma.subscription.findMany({ where, orderBy: { renewalDate: "asc" }, skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
    prisma.subscription.count({ where }),
  ]);
  return { rows, total };
}
