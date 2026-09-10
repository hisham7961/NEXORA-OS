"use server";

import { runAction, type ActionResult } from "@/lib/action";
import { saveView, renameSavedView, deleteSavedView, toggleFavorite } from "@/domain/personal";

export async function saveViewAction(data: { module: string; name: string; filtersJson: string; isShared?: boolean }): Promise<ActionResult<{ id: string }>> {
  return runAction(async (ctx) => ({ id: (await saveView(ctx, data)).id }));
}
export async function renameSavedViewAction(id: string, name: string): Promise<ActionResult> {
  return runAction((ctx) => renameSavedView(ctx, id, name));
}
export async function deleteSavedViewAction(id: string): Promise<ActionResult> {
  return runAction((ctx) => deleteSavedView(ctx, id));
}
export async function toggleFavoriteAction(data: { entityType: string; entityId: string; label?: string; href?: string }): Promise<ActionResult<{ favorited: boolean }>> {
  return runAction((ctx) => toggleFavorite(ctx, data));
}
