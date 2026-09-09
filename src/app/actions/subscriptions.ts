"use server";

import { revalidatePath } from "next/cache";
import { runAction, str, type ActionResult } from "@/lib/action";
import * as Subs from "@/domain/subscriptions";

function buildInput(fd: FormData) {
  return {
    provider: str(fd, "provider"), plan: str(fd, "plan"), companyId: str(fd, "companyId"),
    brandId: str(fd, "brandId"), countryId: str(fd, "countryId"), ownerId: str(fd, "ownerId"),
    currency: str(fd, "currency"), cost: str(fd, "cost"), billingCycle: str(fd, "billingCycle"),
    renewalDate: str(fd, "renewalDate"), autoRenew: fd.get("autoRenew"), paymentMethodRef: str(fd, "paymentMethodRef"),
    licenses: str(fd, "licenses"), notes: str(fd, "notes"),
  };
}

export async function createSubscriptionAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult<{ id: string }>> {
  const res = await runAction(async (ctx) => ({ id: (await Subs.createSubscription(ctx, buildInput(fd))).id }));
  if (res.ok) revalidatePath("/subscriptions");
  return res;
}

export async function updateSubscriptionAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const id = str(fd, "subscriptionId")!;
  const res = await runAction((ctx) => Subs.updateSubscription(ctx, id, buildInput(fd)));
  if (res.ok) { revalidatePath("/subscriptions"); revalidatePath(`/subscriptions/${id}`); }
  return res;
}

export async function renewSubscriptionAction(id: string): Promise<ActionResult> {
  const res = await runAction((ctx) => Subs.renewSubscription(ctx, id));
  if (res.ok) { revalidatePath("/subscriptions"); revalidatePath(`/subscriptions/${id}`); }
  return res;
}

export async function cancelSubscriptionAction(id: string): Promise<ActionResult> {
  const res = await runAction((ctx) => Subs.cancelSubscription(ctx, id));
  if (res.ok) { revalidatePath("/subscriptions"); revalidatePath(`/subscriptions/${id}`); }
  return res;
}

export async function archiveSubscriptionAction(id: string): Promise<ActionResult> {
  const res = await runAction((ctx) => Subs.archiveSubscription(ctx, id));
  if (res.ok) { revalidatePath("/subscriptions"); }
  return res;
}
