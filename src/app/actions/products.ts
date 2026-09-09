"use server";

import { revalidatePath } from "next/cache";
import { runAction, str, type ActionResult } from "@/lib/action";
import * as P from "@/domain/products";

function buildInput(fd: FormData) {
  return {
    brandId: str(fd, "brandId"), name: str(fd, "name"), sku: str(fd, "sku"), barcode: str(fd, "barcode"),
    category: str(fd, "category"), description: str(fd, "description"), status: str(fd, "status"), launchDate: str(fd, "launchDate"),
  };
}

export async function createProductAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult<{ id: string }>> {
  const res = await runAction(async (ctx) => ({ id: (await P.createProduct(ctx, buildInput(fd))).id }));
  if (res.ok) revalidatePath("/products");
  return res;
}

export async function updateProductAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const id = str(fd, "productId")!;
  const res = await runAction((ctx) => P.updateProduct(ctx, id, buildInput(fd)));
  if (res.ok) { revalidatePath("/products"); revalidatePath(`/products/${id}`); }
  return res;
}

export async function archiveProductAction(id: string): Promise<ActionResult> {
  const res = await runAction((ctx) => P.archiveProduct(ctx, id));
  if (res.ok) revalidatePath("/products");
  return res;
}

// sub-entities
export async function addProductVariantAction(productId: string, name: string, sku?: string, size?: string): Promise<ActionResult> {
  const res = await runAction((ctx) => P.addProductVariant(ctx, productId, { name, sku, size }));
  if (res.ok) revalidatePath(`/products/${productId}`);
  return res;
}
export async function removeProductVariantAction(productId: string, variantId: string): Promise<ActionResult> {
  const res = await runAction((ctx) => P.removeProductVariant(ctx, productId, variantId));
  if (res.ok) revalidatePath(`/products/${productId}`);
  return res;
}
export async function setProductMarketAction(productId: string, countryId: string, status: string): Promise<ActionResult> {
  const res = await runAction((ctx) => P.setProductMarket(ctx, productId, countryId, status));
  if (res.ok) revalidatePath(`/products/${productId}`);
  return res;
}
export async function removeProductMarketAction(productId: string, countryId: string): Promise<ActionResult> {
  const res = await runAction((ctx) => P.removeProductMarket(ctx, productId, countryId));
  if (res.ok) revalidatePath(`/products/${productId}`);
  return res;
}
export async function addProductClaimAction(productId: string, claim: string, countryId?: string): Promise<ActionResult> {
  const res = await runAction((ctx) => P.addProductClaim(ctx, productId, { claim, countryId }));
  if (res.ok) revalidatePath(`/products/${productId}`);
  return res;
}
export async function approveProductClaimAction(productId: string, claimId: string): Promise<ActionResult> {
  const res = await runAction((ctx) => P.approveProductClaim(ctx, productId, claimId));
  if (res.ok) revalidatePath(`/products/${productId}`);
  return res;
}
export async function removeProductClaimAction(productId: string, claimId: string): Promise<ActionResult> {
  const res = await runAction((ctx) => P.removeProductClaim(ctx, productId, claimId));
  if (res.ok) revalidatePath(`/products/${productId}`);
  return res;
}
