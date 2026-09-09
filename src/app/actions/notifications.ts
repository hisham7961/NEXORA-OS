"use server";

import { revalidatePath } from "next/cache";
import { runAction, type ActionResult } from "@/lib/action";
import * as N from "@/domain/notifications";

export async function markReadAction(ids: string[], read = true): Promise<ActionResult> {
  const res = await runAction((ctx) => N.markRead(ctx, ids, read));
  if (res.ok) revalidatePath("/notifications");
  return res;
}

export async function archiveNotificationsAction(ids: string[]): Promise<ActionResult> {
  const res = await runAction((ctx) => N.archiveNotifications(ctx, ids));
  if (res.ok) revalidatePath("/notifications");
  return res;
}

export async function markAllReadAction(): Promise<ActionResult> {
  const res = await runAction((ctx) => N.markAllRead(ctx));
  if (res.ok) revalidatePath("/notifications");
  return res;
}

export async function setPreferenceAction(category: string, channel: "inapp" | "email", enabled: boolean): Promise<ActionResult> {
  const res = await runAction((ctx) => N.setPreference(ctx, category, channel, enabled));
  if (res.ok) revalidatePath("/notifications");
  return res;
}
