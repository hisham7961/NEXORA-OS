"use server";

import { revalidatePath } from "next/cache";
import { runAction, str, type ActionResult } from "@/lib/action";
import * as WA from "@/domain/whatsapp";

function buildInput(fd: FormData) {
  return {
    brandId: str(fd, "brandId"),
    countryId: str(fd, "countryId"),
    campaignId: str(fd, "campaignId"),
    audience: str(fd, "audience"),
    objective: str(fd, "objective"),
    messageCopy: str(fd, "messageCopy"),
    plannedDate: str(fd, "plannedDate"),
    responsibleUserId: str(fd, "responsibleUserId"),
  };
}

export async function createWhatsappAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult<{ id: string }>> {
  const res = await runAction(async (ctx) => ({ id: (await WA.createWhatsappCampaign(ctx, buildInput(fd))).id }));
  if (res.ok) revalidatePath("/whatsapp");
  return res;
}

export async function updateWhatsappAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const id = str(fd, "waId")!;
  const res = await runAction((ctx) => WA.updateWhatsappCampaign(ctx, id, buildInput(fd)));
  if (res.ok) { revalidatePath("/whatsapp"); revalidatePath(`/whatsapp/${id}`); }
  return res;
}

export async function setWhatsappStatusAction(id: string, status: string): Promise<ActionResult> {
  const res = await runAction((ctx) => WA.setWhatsappStatus(ctx, id, status));
  if (res.ok) { revalidatePath("/whatsapp"); revalidatePath(`/whatsapp/${id}`); }
  return res;
}

export async function markWhatsappSentAction(id: string): Promise<ActionResult> {
  const res = await runAction((ctx) => WA.markWhatsappSent(ctx, id));
  if (res.ok) { revalidatePath("/whatsapp"); revalidatePath(`/whatsapp/${id}`); }
  return res;
}

export async function recordWhatsappResultsAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const id = str(fd, "waId")!;
  const res = await runAction((ctx) =>
    WA.recordWhatsappResults(ctx, id, {
      sent: str(fd, "sent"),
      delivered: str(fd, "delivered"),
      read: str(fd, "read"),
      replied: str(fd, "replied"),
      optOut: str(fd, "optOut"),
      conversions: str(fd, "conversions"),
      note: str(fd, "note"),
    }),
  );
  if (res.ok) revalidatePath(`/whatsapp/${id}`);
  return res;
}
