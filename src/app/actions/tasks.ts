"use server";

import { revalidatePath } from "next/cache";
import { runAction, str, strList, type ActionResult } from "@/lib/action";
import * as Tasks from "@/domain/tasks";

function buildTaskInput(fd: FormData) {
  return {
    title: str(fd, "title"),
    description: str(fd, "description"),
    priority: str(fd, "priority"),
    status: str(fd, "status"),
    startDate: str(fd, "startDate"),
    dueDate: str(fd, "dueDate"),
    companyId: str(fd, "companyId"),
    brandId: str(fd, "brandId"),
    countryId: str(fd, "countryId"),
    projectId: str(fd, "projectId"),
    productId: str(fd, "productId"),
    campaignId: str(fd, "campaignId"),
    ownerId: str(fd, "ownerId"),
    assigneeIds: strList(fd, "assigneeIds"),
    watcherIds: strList(fd, "watcherIds"),
    approvalRequired: fd.get("approvalRequired") === "on",
    checklist: strList(fd, "checklist"),
  };
}

export async function createTaskAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult<{ id: string }>> {
  const res = await runAction(async (ctx) => {
    const t = await Tasks.createTask(ctx, buildTaskInput(fd));
    return { id: t.id };
  });
  if (res.ok) revalidatePath("/tasks");
  return res;
}

export async function updateTaskAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const id = str(fd, "id")!;
  const res = await runAction((ctx) => Tasks.updateTask(ctx, id, buildTaskInput(fd)));
  if (res.ok) {
    revalidatePath("/tasks");
    revalidatePath(`/tasks/${id}`);
  }
  return res;
}

export async function setTaskStatusAction(id: string, status: string): Promise<ActionResult> {
  const res = await runAction((ctx) => Tasks.setTaskStatus(ctx, id, status));
  if (res.ok) {
    revalidatePath("/tasks");
    revalidatePath(`/tasks/${id}`);
  }
  return res;
}

export async function assignTaskAction(id: string, assigneeIds: string[]): Promise<ActionResult> {
  const res = await runAction((ctx) => Tasks.assignTask(ctx, id, assigneeIds));
  if (res.ok) revalidatePath(`/tasks/${id}`);
  return res;
}

export async function toggleChecklistItemAction(taskId: string, itemId: string, done: boolean): Promise<ActionResult> {
  const res = await runAction((ctx) => Tasks.toggleChecklistItem(ctx, taskId, itemId, done));
  if (res.ok) revalidatePath(`/tasks/${taskId}`);
  return res;
}

export async function addChecklistItemAction(taskId: string, text: string): Promise<ActionResult> {
  const res = await runAction((ctx) => Tasks.addChecklistItem(ctx, taskId, text));
  if (res.ok) revalidatePath(`/tasks/${taskId}`);
  return res;
}

export async function addSubtaskAction(parentId: string, title: string): Promise<ActionResult> {
  const res = await runAction((ctx) => Tasks.addSubtask(ctx, parentId, title));
  if (res.ok) revalidatePath(`/tasks/${parentId}`);
  return res;
}

export async function archiveTaskAction(id: string): Promise<ActionResult> {
  const res = await runAction((ctx) => Tasks.archiveTask(ctx, id));
  if (res.ok) revalidatePath("/tasks");
  return res;
}
