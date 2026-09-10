"use server";

import { runAction, type ActionResult } from "@/lib/action";
import { createWebhook, setWebhookActive, deleteWebhook } from "@/domain/webhooks";

export async function createWebhookAction(input: { name: string; url: string; events: string[] }): Promise<ActionResult<{ id: string; secret: string }>> {
  return runAction((ctx) => createWebhook(ctx, input));
}

export async function setWebhookActiveAction(id: string, active: boolean): Promise<ActionResult<void>> {
  return runAction((ctx) => setWebhookActive(ctx, id, active));
}

export async function deleteWebhookAction(id: string): Promise<ActionResult<void>> {
  return runAction((ctx) => deleteWebhook(ctx, id));
}
