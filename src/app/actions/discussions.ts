"use server";

import { revalidatePath } from "next/cache";
import { runAction, str, strList, type ActionResult } from "@/lib/action";
import * as D from "@/domain/discussions";

export async function createChannelAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult<{ id: string }>> {
  const res = await runAction(async (ctx) => ({
    id: (await D.createChannel(ctx, {
      name: str(fd, "name"), description: str(fd, "description"), type: str(fd, "type"),
      companyId: str(fd, "companyId"), brandId: str(fd, "brandId"), countryId: str(fd, "countryId"),
      isPrivate: fd.get("isPrivate"), memberIds: strList(fd, "memberIds"),
    })).id,
  }));
  if (res.ok) revalidatePath("/discussions");
  return res;
}

export async function postMessageAction(channelId: string, body: string, kind: string, parentId?: string): Promise<ActionResult> {
  const res = await runAction((ctx) => D.postMessage(ctx, channelId, { body, kind, parentId }));
  if (res.ok) revalidatePath(`/discussions/${channelId}`);
  return res;
}

export async function editMessageAction(channelId: string, messageId: string, body: string): Promise<ActionResult> {
  const res = await runAction((ctx) => D.editMessage(ctx, messageId, body));
  if (res.ok) revalidatePath(`/discussions/${channelId}`);
  return res;
}

export async function deleteMessageAction(channelId: string, messageId: string): Promise<ActionResult> {
  const res = await runAction((ctx) => D.deleteMessage(ctx, messageId));
  if (res.ok) revalidatePath(`/discussions/${channelId}`);
  return res;
}

export async function pinMessageAction(channelId: string, messageId: string, pinned: boolean): Promise<ActionResult> {
  const res = await runAction((ctx) => D.setMessagePinned(ctx, messageId, pinned));
  if (res.ok) revalidatePath(`/discussions/${channelId}`);
  return res;
}

export async function reactMessageAction(channelId: string, messageId: string, emoji: string): Promise<ActionResult> {
  const res = await runAction((ctx) => D.toggleReaction(ctx, messageId, emoji));
  if (res.ok) revalidatePath(`/discussions/${channelId}`);
  return res;
}

export async function markReadAction(channelId: string): Promise<ActionResult> {
  const res = await runAction((ctx) => D.markChannelRead(ctx, channelId));
  if (res.ok) revalidatePath("/discussions");
  return res;
}

export async function joinChannelAction(channelId: string): Promise<ActionResult> {
  const res = await runAction((ctx) => D.joinChannel(ctx, channelId));
  if (res.ok) revalidatePath(`/discussions/${channelId}`);
  return res;
}

export async function convertMessageAction(
  channelId: string,
  messageId: string,
  target: D.ConvertTarget,
  extra: { title?: string; assigneeIds?: string[]; approverIds?: string[]; ownerId?: string },
): Promise<ActionResult<{ href: string }>> {
  const res = await runAction(async (ctx) => {
    const r = await D.convertMessage(ctx, messageId, target, extra);
    return { href: r.href };
  });
  if (res.ok) revalidatePath(`/discussions/${channelId}`);
  return res;
}
