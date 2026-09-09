import { z } from "zod";
import type { PublishingItem } from "@prisma/client";
import { prisma } from "@/lib/db";
import { type Principal } from "@/lib/permissions/engine";
import { listQuerySchema } from "@/lib/api/pagination";
import { scopedWhere } from "@/domain/scope";

/** Social publishing control (§10) — planning/scheduling/verification, not an API publisher. */
export const socialQuerySchema = listQuerySchema.extend({ status: z.string().optional(), platform: z.string().optional(), brandId: z.string().optional() });
export type SocialQuery = z.infer<typeof socialQuerySchema>;

export async function listPublishing(principal: Principal, query: SocialQuery): Promise<{ rows: PublishingItem[]; total: number }> {
  const where: Record<string, unknown> = {
    archivedAt: null,
    ...scopedWhere(principal, "social.view", ["brandId", "countryId"], {
      ...(query.status ? { status: query.status } : {}),
      ...(query.platform ? { platform: query.platform } : {}),
      ...(query.brandId ? { brandId: query.brandId } : {}),
      ...(query.q ? { OR: [{ caption: { contains: query.q, mode: "insensitive" } }] } : {}),
    }),
  };
  const [rows, total] = await Promise.all([
    prisma.publishingItem.findMany({ where, orderBy: { publishDate: "desc" }, skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
    prisma.publishingItem.count({ where }),
  ]);
  return { rows, total };
}
