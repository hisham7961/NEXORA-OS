import { z } from "zod";
import type { CreativeAsset } from "@prisma/client";
import { prisma } from "@/lib/db";
import { accessibleScopeIds, assertRecordInScope, type Principal } from "@/lib/permissions/engine";
import { listQuerySchema } from "@/lib/api/pagination";
import { assertCan, audit, type ActorContext } from "@/domain/mutation";
import { ServiceError } from "@/lib/api/handler";
import { optionalString } from "@/lib/validation";

/** Creative Library (§12). Scoped by brand. */
export const creativeQuerySchema = listQuerySchema.extend({ platform: z.string().optional(), brandId: z.string().optional() });
export type CreativeQuery = z.infer<typeof creativeQuerySchema>;

/** Asset kinds a library entry can be (mirrors design request asset types). */
export const CREATIVE_ASSET_TYPES = ["post", "story", "reel", "banner", "packaging", "video", "print", "email", "web", "other"] as const;

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

export const creativeCreateSchema = z.object({
  assetType: z.enum(CREATIVE_ASSET_TYPES),
  brandId: z.string().min(1), // a library asset belongs to a brand (its scope dimension)
  platform: optionalString,
  productId: optionalString,
  countryId: optionalString,
  campaignId: optionalString,
  designerId: optionalString,
  designRequestId: optionalString,
  tags: optionalString,
});

/** Comma / newline separated tags → a JSON text column (§4: JSON stored as text). */
function tagsToJson(raw: string | undefined): string | null {
  if (!raw) return null;
  const tags = raw.split(/[,\n]/).map((s) => s.trim()).filter(Boolean);
  return tags.length ? JSON.stringify(tags) : null;
}

/**
 * Add a creative asset to the library (§12 — audit DOM-03). The library was
 * read-only; this is the write path. Fail-closed on the NEW asset's brand scope
 * (§69), then audit. Metadata-first: the file is attached via the File platform
 * as a follow-up, so no client-supplied fileId is trusted here (avoids IDOR).
 */
export async function createCreativeAsset(ctx: ActorContext, raw: unknown): Promise<CreativeAsset> {
  const input = creativeCreateSchema.parse(raw);
  assertCan(ctx.principal, "creative_library.create", { brandId: input.brandId });
  const asset = await prisma.creativeAsset.create({
    data: {
      assetType: input.assetType,
      brandId: input.brandId,
      platform: input.platform ?? null,
      productId: input.productId ?? null,
      countryId: input.countryId ?? null,
      campaignId: input.campaignId ?? null,
      designerId: input.designerId ?? null,
      designRequestId: input.designRequestId ?? null,
      tagsJson: tagsToJson(input.tags),
    },
  });
  await audit(ctx, { action: "creative_asset.created", entityType: "CreativeAsset", entityId: asset.id, summary: `${asset.assetType} added to library`, brandId: asset.brandId });
  return asset;
}

/** Mark a library asset approved (§12). Fail-closed on the asset's brand scope. */
export async function approveCreativeAsset(ctx: ActorContext, id: string): Promise<CreativeAsset> {
  const existing = await prisma.creativeAsset.findUnique({ where: { id } });
  if (!existing || existing.archivedAt) throw new ServiceError("not_found", "Asset not found", 404);
  assertRecordInScope(ctx.principal, "creative_library.edit", { brandId: existing.brandId }, ["brandId"]);
  const asset = await prisma.creativeAsset.update({ where: { id }, data: { approvedAt: existing.approvedAt ?? new Date() } });
  await audit(ctx, { action: "creative_asset.approved", entityType: "CreativeAsset", entityId: asset.id, summary: "Asset approved", brandId: asset.brandId });
  return asset;
}
