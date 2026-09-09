"use server";

import { revalidatePath } from "next/cache";
import { runAction, str, strList, type ActionResult } from "@/lib/action";
import * as K from "@/domain/knowledge";

function buildInput(fd: FormData) {
  return {
    title: str(fd, "title"), body: str(fd, "body"), category: str(fd, "category"),
    tags: strList(fd, "tags"), brandId: str(fd, "brandId"), productId: str(fd, "productId"),
    countryId: str(fd, "countryId"), reviewerId: str(fd, "reviewerId"), reviewDueAt: str(fd, "reviewDueAt"),
  };
}

export async function createArticleAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult<{ id: string }>> {
  const res = await runAction(async (ctx) => ({ id: (await K.createArticleDraft(ctx, buildInput(fd))).id }));
  if (res.ok) revalidatePath("/knowledge");
  return res;
}

export async function updateArticleAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const id = str(fd, "articleId")!;
  const res = await runAction((ctx) => K.updateArticleDraft(ctx, id, buildInput(fd)));
  if (res.ok) revalidatePath(`/knowledge/${id}`);
  return res;
}

export async function createArticleRevisionAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const id = str(fd, "articleId")!;
  const res = await runAction((ctx) => K.createArticleRevision(ctx, id, str(fd, "body") ?? "", str(fd, "changeNote"), str(fd, "title")));
  if (res.ok) revalidatePath(`/knowledge/${id}`);
  return res;
}

export async function submitArticleAction(id: string): Promise<ActionResult> {
  const res = await runAction((ctx) => K.submitArticleForReview(ctx, id));
  if (res.ok) { revalidatePath("/knowledge"); revalidatePath(`/knowledge/${id}`); }
  return res;
}

export async function publishArticleAction(id: string): Promise<ActionResult> {
  const res = await runAction((ctx) => K.publishArticle(ctx, id));
  if (res.ok) { revalidatePath("/knowledge"); revalidatePath(`/knowledge/${id}`); }
  return res;
}

export async function archiveArticleAction(id: string): Promise<ActionResult> {
  const res = await runAction((ctx) => K.archiveArticle(ctx, id));
  if (res.ok) { revalidatePath("/knowledge"); revalidatePath(`/knowledge/${id}`); }
  return res;
}

export async function markArticleReviewedAction(id: string): Promise<ActionResult> {
  const res = await runAction((ctx) => K.markArticleReviewed(ctx, id));
  if (res.ok) revalidatePath(`/knowledge/${id}`);
  return res;
}
