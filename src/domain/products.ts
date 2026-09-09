import { z } from "zod";
import type { Product } from "@prisma/client";
import { prisma } from "@/lib/db";
import { assertRecordInScope, type Principal } from "@/lib/permissions/engine";
import { listQuerySchema } from "@/lib/api/pagination";
import { scopedWhere, DIMS_BRAND } from "@/domain/scope";
import { ServiceError } from "@/lib/api/handler";
import { assertCan, audit, type ActorContext } from "@/domain/mutation";
import { optionalString, optionalDate } from "@/lib/validation";

/** Products list query = base list params + module-specific filters (§13). */
export const productQuerySchema = listQuerySchema.extend({
  status: z.string().optional(),
  brandId: z.string().optional(),
  category: z.string().optional(),
});
export type ProductQuery = z.infer<typeof productQuerySchema>;

export interface ProductRow {
  id: string;
  brandId: string;
  name: string;
  sku: string;
  category: string | null;
  status: string;
}

/**
 * Product master (§13). Products are brand-scoped: a brand-scoped user only ever
 * sees products of brands they can reach (server-side scope, §3/§69). Product has
 * a `brandId` column only among the scope dimensions, so we scope on ["brandId"].
 */
export async function listProducts(
  principal: Principal,
  query: ProductQuery,
): Promise<{ rows: ProductRow[]; total: number }> {
  const where = {
    archivedAt: null,
    ...scopedWhere(principal, "products.view", DIMS_BRAND, {
      ...(query.status ? { status: query.status } : {}),
      ...(query.brandId ? { brandId: query.brandId } : {}),
      ...(query.category ? { category: query.category } : {}),
      ...(query.q ? { OR: [{ name: { contains: query.q, mode: "insensitive" } }, { sku: { contains: query.q, mode: "insensitive" } }] } : {}),
    }),
  };

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.product.count({ where }),
  ]);

  return {
    rows: products.map((p) => ({
      id: p.id,
      brandId: p.brandId,
      name: p.name,
      sku: p.sku,
      category: p.category,
      status: p.status,
    })),
    total,
  };
}

/**
 * Product 360 (§44). Loads the product with its variants, markets, claims and
 * every related record referenced by scalar id (campaigns via the CampaignProduct
 * join, plus registrations, documents and customer cases that point at this
 * product). Fail-closed scope guard (§69): a brand-scoped user cannot open a
 * product outside their brands by tampering with the id.
 */
export async function getProduct(principal: Principal, id: string) {
  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) return null;
  assertRecordInScope(principal, "products.view", { brandId: product.brandId }, DIMS_BRAND);

  const [variants, markets, claims, campaignLinks, registrations, documents, cases] = await Promise.all([
    prisma.productVariant.findMany({ where: { productId: id }, orderBy: { name: "asc" } }),
    prisma.productMarket.findMany({ where: { productId: id } }),
    prisma.productClaim.findMany({ where: { productId: id }, orderBy: { createdAt: "desc" } }),
    prisma.campaignProduct.findMany({ where: { productId: id }, include: { campaign: true } }),
    prisma.registrationCase.findMany({ where: { productId: id, archivedAt: null }, orderBy: { updatedAt: "desc" }, take: 25 }),
    prisma.document.findMany({ where: { productId: id, archivedAt: null }, orderBy: { expiryDate: "asc" }, take: 25 }),
    prisma.customerCase.findMany({ where: { productId: id, archivedAt: null }, orderBy: { updatedAt: "desc" }, take: 25 }),
  ]);

  const campaigns = campaignLinks.map((l) => l.campaign).filter((c) => c.archivedAt === null);

  return { product, variants, markets, claims, campaigns, registrations, documents, cases };
}

// ---------------------------------------------------------------------------
// PRODUCT MASTER WRITE PATHS (§7 / audit). Brand-scoped: create/edit/archive is
// gated by products.* in the target brand's scope, audited, and soft-deletes via
// archivedAt. SKU uniqueness is enforced by the DB (@unique) and surfaced cleanly.
// ---------------------------------------------------------------------------
export const productInputSchema = z.object({
  brandId: z.string().min(1),
  name: z.string().trim().min(1).max(160),
  sku: z.string().trim().min(1).max(60),
  barcode: optionalString,
  category: optionalString,
  description: optionalString,
  status: z.preprocess((v) => (typeof v === "string" && v.trim() ? v.trim() : undefined), z.string().default("active")),
  launchDate: optionalDate,
});

export async function createProduct(ctx: ActorContext, raw: unknown): Promise<Product> {
  const input = productInputSchema.parse(raw);
  assertCan(ctx.principal, "products.create", { brandId: input.brandId });
  const dupe = await prisma.product.findUnique({ where: { sku: input.sku } });
  if (dupe) throw new ServiceError("sku_taken", `SKU "${input.sku}" is already in use.`, 422);
  const product = await prisma.product.create({
    data: {
      brandId: input.brandId, name: input.name, sku: input.sku, barcode: input.barcode ?? null,
      category: input.category ?? null, description: input.description ?? null, status: input.status,
      launchDate: input.launchDate ?? null, createdById: ctx.principal.userId,
    },
  });
  await audit(ctx, { action: "product.created", entityType: "Product", entityId: product.id, summary: `${input.name} (${input.sku})`, brandId: product.brandId });
  return product;
}

async function loadEditableProduct(ctx: ActorContext, id: string, action = "products.edit"): Promise<Product> {
  const p = await prisma.product.findUnique({ where: { id } });
  if (!p || p.archivedAt) throw new ServiceError("not_found", "Product not found", 404);
  assertCan(ctx.principal, action, { brandId: p.brandId });
  return p;
}

export async function updateProduct(ctx: ActorContext, id: string, raw: unknown): Promise<Product> {
  const p = await loadEditableProduct(ctx, id);
  const input = productInputSchema.partial().parse(raw);
  // Moving a product to another brand requires create rights in the destination.
  if (input.brandId && input.brandId !== p.brandId) assertCan(ctx.principal, "products.create", { brandId: input.brandId });
  if (input.sku && input.sku !== p.sku) {
    const dupe = await prisma.product.findUnique({ where: { sku: input.sku } });
    if (dupe) throw new ServiceError("sku_taken", `SKU "${input.sku}" is already in use.`, 422);
  }
  const data: Record<string, unknown> = {};
  for (const k of ["brandId", "name", "sku", "barcode", "category", "description", "status"] as const) {
    if (input[k] !== undefined) data[k] = input[k] ?? null;
  }
  if (input.launchDate !== undefined) data.launchDate = input.launchDate ?? null;
  const updated = await prisma.product.update({ where: { id }, data });
  await audit(ctx, { action: "product.updated", entityType: "Product", entityId: id, summary: updated.name, brandId: updated.brandId });
  return updated;
}

export async function archiveProduct(ctx: ActorContext, id: string): Promise<void> {
  const p = await loadEditableProduct(ctx, id, "products.delete");
  await prisma.product.update({ where: { id }, data: { archivedAt: new Date(), status: "archived" } });
  await audit(ctx, { action: "product.archived", entityType: "Product", entityId: id, summary: p.name, brandId: p.brandId });
}

// --- Variants -------------------------------------------------------------
export async function addProductVariant(ctx: ActorContext, productId: string, raw: unknown): Promise<void> {
  const p = await loadEditableProduct(ctx, productId);
  const input = z.object({ name: z.string().trim().min(1).max(120), sku: optionalString, size: optionalString }).parse(raw);
  await prisma.productVariant.create({ data: { productId, name: input.name, sku: input.sku ?? null, size: input.size ?? null } });
  await audit(ctx, { action: "product.variant_added", entityType: "Product", entityId: productId, summary: input.name, brandId: p.brandId });
}

export async function removeProductVariant(ctx: ActorContext, productId: string, variantId: string): Promise<void> {
  const p = await loadEditableProduct(ctx, productId);
  await prisma.productVariant.deleteMany({ where: { id: variantId, productId } });
  await audit(ctx, { action: "product.variant_removed", entityType: "Product", entityId: productId, summary: variantId, brandId: p.brandId });
}

// --- Market availability ---------------------------------------------------
export async function setProductMarket(ctx: ActorContext, productId: string, countryId: string, status = "planned"): Promise<void> {
  const p = await loadEditableProduct(ctx, productId);
  await prisma.productMarket.upsert({
    where: { productId_countryId: { productId, countryId } },
    update: { status },
    create: { productId, countryId, status },
  });
  await audit(ctx, { action: "product.market_set", entityType: "Product", entityId: productId, summary: `${countryId} → ${status}`, brandId: p.brandId });
}

export async function removeProductMarket(ctx: ActorContext, productId: string, countryId: string): Promise<void> {
  const p = await loadEditableProduct(ctx, productId);
  await prisma.productMarket.deleteMany({ where: { productId, countryId } });
  await audit(ctx, { action: "product.market_removed", entityType: "Product", entityId: productId, summary: countryId, brandId: p.brandId });
}

// --- Claims (approval-gated) ----------------------------------------------
export async function addProductClaim(ctx: ActorContext, productId: string, raw: unknown): Promise<void> {
  const p = await loadEditableProduct(ctx, productId);
  const input = z.object({ claim: z.string().trim().min(1).max(500), countryId: optionalString }).parse(raw);
  await prisma.productClaim.create({ data: { productId, claim: input.claim, countryId: input.countryId ?? null, isApproved: false } });
  await audit(ctx, { action: "product.claim_added", entityType: "Product", entityId: productId, summary: input.claim.slice(0, 100), brandId: p.brandId });
}

export async function approveProductClaim(ctx: ActorContext, productId: string, claimId: string): Promise<void> {
  const p = await loadEditableProduct(ctx, productId, "products.manage");
  await prisma.productClaim.updateMany({ where: { id: claimId, productId }, data: { isApproved: true, approvedById: ctx.principal.userId } });
  await audit(ctx, { action: "product.claim_approved", entityType: "Product", entityId: productId, summary: claimId, brandId: p.brandId });
}

export async function removeProductClaim(ctx: ActorContext, productId: string, claimId: string): Promise<void> {
  const p = await loadEditableProduct(ctx, productId);
  await prisma.productClaim.deleteMany({ where: { id: claimId, productId } });
  await audit(ctx, { action: "product.claim_removed", entityType: "Product", entityId: productId, summary: claimId, brandId: p.brandId });
}
