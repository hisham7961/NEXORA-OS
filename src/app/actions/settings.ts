"use server";

import { revalidatePath } from "next/cache";
import { runAction, type ActionResult } from "@/lib/action";
import { updateSetting } from "@/domain/settings";

export async function updateSettingAction(key: string, value: unknown): Promise<ActionResult> {
  const res = await runAction((ctx) => updateSetting(ctx, key, value));
  if (res.ok) revalidatePath("/admin/settings");
  return res;
}
