"use server";

import { revalidatePath } from "next/cache";
import { runAction, str, type ActionResult } from "@/lib/action";
import * as A from "@/domain/answers";

export async function createAnswerDraftAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult<{ id: string }>> {
  const res = await runAction(async (ctx) => ({
    id: (await A.createAnswerDraft(ctx, {
      question: str(fd, "question"), answer: str(fd, "answer"), brandId: str(fd, "brandId"),
      productId: str(fd, "productId"), countryId: str(fd, "countryId"), category: str(fd, "category"), language: str(fd, "language"),
    })).id,
  }));
  if (res.ok) revalidatePath("/answers");
  return res;
}

export async function updateAnswerDraftAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const id = str(fd, "answerId")!;
  const res = await runAction((ctx) => A.updateAnswerDraft(ctx, id, {
    question: str(fd, "question"), answer: str(fd, "answer"), category: str(fd, "category"), language: str(fd, "language"),
  }));
  if (res.ok) revalidatePath(`/answers/${id}`);
  return res;
}

export async function createRevisionAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const id = str(fd, "answerId")!;
  const res = await runAction((ctx) => A.createAnswerRevision(ctx, id, str(fd, "answer") ?? "", str(fd, "changeNote")));
  if (res.ok) revalidatePath(`/answers/${id}`);
  return res;
}

export async function submitAnswerAction(id: string): Promise<ActionResult> {
  const res = await runAction((ctx) => A.submitAnswerForApproval(ctx, id));
  if (res.ok) { revalidatePath("/answers"); revalidatePath(`/answers/${id}`); }
  return res;
}

export async function approveAnswerAction(id: string): Promise<ActionResult> {
  const res = await runAction((ctx) => A.approveAnswer(ctx, id));
  if (res.ok) { revalidatePath("/answers"); revalidatePath(`/answers/${id}`); }
  return res;
}

export async function retireAnswerAction(id: string): Promise<ActionResult> {
  const res = await runAction((ctx) => A.retireAnswer(ctx, id));
  if (res.ok) { revalidatePath("/answers"); revalidatePath(`/answers/${id}`); }
  return res;
}

export async function createAnswerRequestAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const res = await runAction((ctx) => A.createAnswerRequest(ctx, {
    question: str(fd, "question"), brandId: str(fd, "brandId"), productId: str(fd, "productId"), countryId: str(fd, "countryId"), context: str(fd, "context"),
  }));
  if (res.ok) revalidatePath("/answers");
  return res;
}

/** Record a copy/use event (§16) — invoked from the library and from cases. */
export async function recordAnswerUsageAction(answerId: string, caseId?: string): Promise<ActionResult> {
  return runAction((ctx) => A.recordAnswerUsage(ctx, answerId, caseId));
}
