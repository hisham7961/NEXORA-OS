"use server";

import { runAction, type ActionResult } from "@/lib/action";
import { addComment, editComment, deleteComment } from "@/domain/comments";

export async function addCommentAction(data: { entityType: string; entityId: string; body: string; parentId?: string }): Promise<ActionResult<{ id: string }>> {
  return runAction(async (ctx) => ({ id: (await addComment(ctx, data)).id }));
}
export async function editCommentAction(id: string, body: string): Promise<ActionResult> {
  return runAction((ctx) => editComment(ctx, id, body));
}
export async function deleteCommentAction(id: string): Promise<ActionResult> {
  return runAction((ctx) => deleteComment(ctx, id));
}
