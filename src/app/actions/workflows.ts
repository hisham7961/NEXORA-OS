"use server";

import { revalidatePath } from "next/cache";
import { runAction, str, type ActionResult } from "@/lib/action";
import * as WF from "@/domain/workflows";
import type { WorkflowSpec, ValidationResult } from "@/lib/workflow/spec";

// --- Definition authoring (create uses the ActionForm signature) -----------
export async function createWorkflowAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult<{ id: string }>> {
  const res = await runAction(async (ctx) => ({
    id: (await WF.createWorkflow(ctx, {
      key: str(fd, "key"), name: str(fd, "name"), module: str(fd, "module"), description: str(fd, "description"),
      companyId: str(fd, "companyId"), brandId: str(fd, "brandId"), countryId: str(fd, "countryId"),
    })).id,
  }));
  if (res.ok) revalidatePath("/workflows");
  return res;
}

export async function updateWorkflowMetaAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const id = str(fd, "workflowId")!;
  const res = await runAction((ctx) => WF.updateWorkflowMeta(ctx, id, { name: str(fd, "name"), description: str(fd, "description") }));
  if (res.ok) { revalidatePath("/workflows"); revalidatePath(`/workflows/${id}`); }
  return res;
}

/** Save the builder's spec into the current draft; returns the validation result. */
export async function saveWorkflowDraftAction(id: string, spec: WorkflowSpec, changeNote?: string): Promise<ActionResult<ValidationResult>> {
  const res = await runAction((ctx) => WF.saveWorkflowDraft(ctx, id, spec, changeNote));
  if (res.ok) revalidatePath(`/workflows/${id}`);
  return res;
}

export async function openWorkflowRevisionAction(id: string): Promise<ActionResult<{ versionId: string }>> {
  const res = await runAction(async (ctx) => ({ versionId: (await WF.openWorkflowRevision(ctx, id)).id }));
  if (res.ok) revalidatePath(`/workflows/${id}`);
  return res;
}

export async function activateWorkflowVersionAction(id: string, versionId: string): Promise<ActionResult> {
  const res = await runAction((ctx) => WF.activateWorkflowVersion(ctx, id, versionId));
  if (res.ok) { revalidatePath("/workflows"); revalidatePath(`/workflows/${id}`); }
  return res;
}

export async function archiveWorkflowAction(id: string): Promise<ActionResult> {
  const res = await runAction((ctx) => WF.archiveWorkflow(ctx, id));
  if (res.ok) revalidatePath("/workflows");
  return res;
}

// --- Instance runtime ------------------------------------------------------
export async function performTransitionAction(instanceId: string, transitionKey: string, note?: string, fieldValues?: Record<string, string>): Promise<ActionResult> {
  const res = await runAction((ctx) => WF.performTransition(ctx, instanceId, { transitionKey, note, fieldValues }));
  if (res.ok) revalidatePath("/workflows");
  return res;
}

export async function startWorkflowInstanceAction(input: { definitionId?: string; definitionKey?: string; entityType: string; entityId: string; scope?: { companyId: string | null; brandId: string | null; countryId: string | null } }): Promise<ActionResult<{ id: string }>> {
  const res = await runAction(async (ctx) => ({ id: (await WF.startWorkflowInstance(ctx, input)).id }));
  return res;
}
