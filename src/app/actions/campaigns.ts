"use server";

import { revalidatePath } from "next/cache";
import { runAction, str, type ActionResult } from "@/lib/action";
import * as Campaigns from "@/domain/campaigns";

function buildInput(fd: FormData) {
  return {
    name: str(fd, "name"),
    type: str(fd, "type"),
    objective: str(fd, "objective"),
    companyId: str(fd, "companyId"),
    brandId: str(fd, "brandId"),
    countryId: str(fd, "countryId"),
    storeId: str(fd, "storeId"),
    ownerId: str(fd, "ownerId"),
    currency: str(fd, "currency"),
    plannedBudget: str(fd, "plannedBudget"),
    actualSpend: str(fd, "actualSpend"),
    targetAudience: str(fd, "targetAudience"),
    startDate: str(fd, "startDate"),
    endDate: str(fd, "endDate"),
    notes: str(fd, "notes"),
  };
}

export async function createCampaignAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult<{ id: string }>> {
  const res = await runAction(async (ctx) => ({ id: (await Campaigns.createCampaign(ctx, buildInput(fd))).id }));
  if (res.ok) revalidatePath("/campaigns");
  return res;
}

export async function updateCampaignAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const id = str(fd, "campaignId")!;
  const res = await runAction((ctx) => Campaigns.updateCampaign(ctx, id, buildInput(fd)));
  if (res.ok) {
    revalidatePath("/campaigns");
    revalidatePath(`/campaigns/${id}`);
  }
  return res;
}

export async function setCampaignStatusAction(id: string, status: string): Promise<ActionResult> {
  const res = await runAction((ctx) => Campaigns.setCampaignStatus(ctx, id, status));
  if (res.ok) {
    revalidatePath("/campaigns");
    revalidatePath(`/campaigns/${id}`);
  }
  return res;
}

export async function addCampaignMetricAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const id = str(fd, "campaignId")!;
  const res = await runAction((ctx) =>
    Campaigns.addCampaignMetric(ctx, id, {
      name: str(fd, "name"),
      value: str(fd, "value"),
      unit: str(fd, "unit"),
      isTarget: fd.get("isTarget"),
      date: str(fd, "date"),
      note: str(fd, "note"),
    }),
  );
  if (res.ok) revalidatePath(`/campaigns/${id}`);
  return res;
}
