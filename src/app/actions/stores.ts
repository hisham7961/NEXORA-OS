"use server";

import { revalidatePath } from "next/cache";
import { runAction, str, type ActionResult } from "@/lib/action";
import * as Stores from "@/domain/stores";

export async function recordPerformanceAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const storeId = str(fd, "storeId")!;
  const res = await runAction((ctx) =>
    Stores.recordStorePerformance(ctx, storeId, {
      periodType: str(fd, "periodType"),
      periodStart: str(fd, "periodStart"),
      periodEnd: str(fd, "periodEnd"),
      sales: str(fd, "sales"),
      orders: str(fd, "orders"),
      unitsSold: str(fd, "unitsSold"),
      returns: str(fd, "returns"),
      refunds: str(fd, "refunds"),
      adSpend: str(fd, "adSpend"),
      discounts: str(fd, "discounts"),
      shippingCost: str(fd, "shippingCost"),
      cogs: str(fd, "cogs"),
      notes: str(fd, "notes"),
    }),
  );
  if (res.ok) {
    revalidatePath(`/stores/${storeId}`);
    revalidatePath("/sales");
  }
  return res;
}
