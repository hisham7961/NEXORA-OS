import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertRecordInScope, type Principal } from "@/lib/permissions/engine";
import { listQuerySchema } from "@/lib/api/pagination";
import { scopedWhere, DIMS_BRAND } from "@/domain/scope";

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
      ...(query.q ? { OR: [{ name: { contains: query.q } }, { sku: { contains: query.q } }] } : {}),
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
