import { z } from "zod";
import type { CreativeAsset } from "@prisma/client";
import { prisma } from "@/lib/db";
import { accessibleScopeIds, type Principal } from "@/lib/permissions/engine";
import { listQuerySchema } from "@/lib/api/pagination";

/** Creative Library (§12). Scoped by brand. */
export const creativeQuerySchema = listQuerySchema.extend({ platform: z.string().optional(), brandId: z.string().optional() });
export type CreativeQuery = z.infer<typeof creativeQuerySchema>;

export async function listCreativeAssets(principal: Principal, query: CreativeQuery): Promise<{ rows: CreativeAsset[]; total: number }> {
  const ids = accessibleScopeIds(principal, "creative_library.view", "brandId");
  const where: Record<string, unknown> = {
    archivedAt: null,
    ...(ids === "all" ? {} : { brandId: { in: ids } }),
    ...(query.platform ? { platform: query.platform } : {}),
    ...(query.brandId ? { brandId: query.brandId } : {}),
    ...(query.q ? { assetType: { contains: query.q, mode: "insensitive" } } : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.creativeAsset.findMany({ where, orderBy: { createdAt: "desc" }, skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
    prisma.creativeAsset.count({ where }),
  ]);
  return { rows, total };
}
