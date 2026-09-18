"use server";

import { runAction, str, type ActionResult } from "@/lib/action";
import { createCreativeAsset } from "@/domain/creative";

/** Add a creative asset to the library (audit DOM-03). */
export async function createCreativeAssetAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult<{ id: string }>> {
  return runAction(async (ctx) => {
    const asset = await createCreativeAsset(ctx, {
      assetType: str(fd, "assetType"),
      brandId: str(fd, "brandId"),
      platform: str(fd, "platform"),
      productId: str(fd, "productId"),
      countryId: str(fd, "countryId"),
      campaignId: str(fd, "campaignId"),
      designerId: str(fd, "designerId"),
      designRequestId: str(fd, "designRequestId"),
      tags: str(fd, "tags"),
    });
    return { id: asset.id };
  });
}
