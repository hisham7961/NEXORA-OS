"use server";

import { revalidatePath } from "next/cache";
import { runAction, str, type ActionResult } from "@/lib/action";
import * as Social from "@/domain/social";

function buildItem(fd: FormData) {
  return {
    contentType: str(fd, "contentType"),
    platform: str(fd, "platform"),
    brandId: str(fd, "brandId"),
    countryId: str(fd, "countryId"),
    socialAccountId: str(fd, "socialAccountId"),
    productId: str(fd, "productId"),
    campaignId: str(fd, "campaignId"),
    publishDate: str(fd, "publishDate"),
    publishTime: str(fd, "publishTime"),
    caption: str(fd, "caption"),
    ownerId: str(fd, "ownerId"),
    designerId: str(fd, "designerId"),
    notes: str(fd, "notes"),
  };
}

export async function createPublishingAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult<{ id: string }>> {
  const res = await runAction(async (ctx) => ({ id: (await Social.createPublishingItem(ctx, buildItem(fd))).id }));
  if (res.ok) revalidatePath("/social");
  return res;
}

export async function updatePublishingAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const id = str(fd, "itemId")!;
  const res = await runAction((ctx) => Social.updatePublishingItem(ctx, id, buildItem(fd)));
  if (res.ok) { revalidatePath("/social"); revalidatePath(`/social/${id}`); }
  return res;
}

export async function setPublishingStatusAction(id: string, status: string): Promise<ActionResult> {
  const res = await runAction((ctx) => Social.setPublishingStatus(ctx, id, status));
  if (res.ok) { revalidatePath("/social"); revalidatePath(`/social/${id}`); }
  return res;
}

export async function confirmScheduledAction(id: string): Promise<ActionResult> {
  const res = await runAction((ctx) => Social.confirmScheduled(ctx, id));
  if (res.ok) { revalidatePath("/social"); revalidatePath(`/social/${id}`); }
  return res;
}

export async function confirmPublishedAction(id: string, publishedUrl: string): Promise<ActionResult> {
  const res = await runAction((ctx) => Social.confirmPublished(ctx, id, publishedUrl));
  if (res.ok) { revalidatePath("/social"); revalidatePath(`/social/${id}`); }
  return res;
}

export async function createRecurrenceAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const res = await runAction((ctx) =>
    Social.createRecurrence(ctx, {
      brandId: str(fd, "brandId"),
      countryId: str(fd, "countryId"),
      platform: str(fd, "platform"),
      contentType: str(fd, "contentType"),
      startDate: str(fd, "startDate"),
      days: str(fd, "days"),
      ownerId: str(fd, "ownerId"),
    }),
  );
  if (res.ok) revalidatePath("/social");
  return res;
}
