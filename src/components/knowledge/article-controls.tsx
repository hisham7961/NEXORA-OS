"use client";

import { useCreateShortcut } from "@/lib/use-create-shortcut";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Send, BookCheck, Archive, CheckCircle2 } from "lucide-react";
import { Button, Input, Textarea, Select, Drawer } from "@/components/ui";
import { ActionForm, FormField, FormSection } from "@/components/form/action-form";
import { useToast, useI18n } from "@/components/providers";
import { createArticleAction, updateArticleAction, createArticleRevisionAction, submitArticleAction, publishArticleAction, archiveArticleAction, markArticleReviewedAction } from "@/app/actions/knowledge";
import type { Option } from "@/domain/options";

const CATEGORIES = ["sop", "company_policy", "brand_info", "product_info", "marketing", "customer_service", "regulatory", "commerce", "creative", "hr_ops", "custom"];

function TagsInput({ initial = "" }: { initial?: string }) {
  const { t } = useI18n();
  const [raw, setRaw] = useState(initial);
  const tags = raw.split(",").map((t) => t.trim()).filter(Boolean);
  return (<><Input value={raw} onChange={(e) => setRaw(e.target.value)} placeholder={t("artf.phArtTags")} />{tags.map((t) => <input key={t} type="hidden" name="tags" value={t} />)}</>);
}

export function NewArticleButton({ options }: { options: { brands: Option[]; countries: Option[]; users: Option[] } }) {
  const [open, setOpen] = useState(false);
  useCreateShortcut(() => setOpen(true));
  const router = useRouter();
  const { t } = useI18n();
  return (
    <>
      <Button variant="primary" size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> {t("artf.newArticle")}</Button>
      <Drawer open={open} onClose={() => setOpen(false)} title={t("artf.newArticleTitle")} description={t("artf.newArticleSub")} width="680px">
        <ActionForm action={createArticleAction} submitLabel={t("artf.createDraft")} onCancel={() => setOpen(false)} onSuccess={(d) => { setOpen(false); const id = (d as { id?: string })?.id; if (id) router.push(`/knowledge/${id}`); }}>
          <FormField label={t("artf.title")} name="title" required><Input name="title" required placeholder={t("artf.phTitle")} /></FormField>
          <FormField label={t("artf.body")} name="body" required><Textarea name="body" required className="min-h-40" placeholder={t("artf.phBody")} /></FormField>
          <FormSection>
            <FormField label={t("common.category")} name="category"><Select name="category" defaultValue="sop">{CATEGORIES.map((c) => <option key={c} value={c}>{c.replace(/_/g, " ")}</option>)}</Select></FormField>
            <FormField label={t("common.brand")} name="brandId"><Select name="brandId" defaultValue=""><option value="">{t("wf.allBrands")}</option>{options.brands.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}</Select></FormField>
            <FormField label={t("artf.reviewer")} name="reviewerId"><Select name="reviewerId" defaultValue=""><option value="">—</option>{options.users.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}</Select></FormField>
            <FormField label={t("artf.nextReviewDue")} name="reviewDueAt"><Input type="date" name="reviewDueAt" /></FormField>
          </FormSection>
          <FormField label={t("filef.tags")} name="tags" hint={t("filef.commaSep")}><TagsInput /></FormField>
        </ActionForm>
      </Drawer>
    </>
  );
}

export function EditDraftButton({ article }: { article: { id: string; title: string; category: string | null; tags: string[]; draftBody: string } }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { t } = useI18n();
  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}><Pencil className="h-4 w-4" /> {t("artf.editDraft")}</Button>
      <Drawer open={open} onClose={() => setOpen(false)} title={t("artf.editDraft")} description={t("artf.editDraftSub")} width="680px">
        <ActionForm action={updateArticleAction} submitLabel={t("artf.saveDraft")} onCancel={() => setOpen(false)} onSuccess={() => { setOpen(false); router.refresh(); }}>
          <input type="hidden" name="articleId" value={article.id} />
          <FormField label={t("artf.title")} name="title" required><Input name="title" defaultValue={article.title} required /></FormField>
          <FormField label={t("artf.body")} name="body" required><Textarea name="body" defaultValue={article.draftBody} required className="min-h-40" /></FormField>
          <FormSection>
            <FormField label={t("common.category")} name="category"><Select name="category" defaultValue={article.category ?? "sop"}>{CATEGORIES.map((c) => <option key={c} value={c}>{c.replace(/_/g, " ")}</option>)}</Select></FormField>
          </FormSection>
          <FormField label={t("filef.tags")} name="tags" hint={t("filef.commaSep")}><TagsInput initial={article.tags.join(", ")} /></FormField>
        </ActionForm>
      </Drawer>
    </>
  );
}

function useRun() {
  const router = useRouter();
  const { toast } = useToast();
  const { t } = useI18n();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, ok?: string) =>
    start(async () => { const r = await fn(); if (r.ok) { if (ok) toast({ kind: "success", title: ok }); router.refresh(); } else toast({ kind: "error", title: r.error ?? t("ansf.failed") }); });
  return { run, pending };
}

export function ArticleLifecycle({ articleId, status, hasDraft, hasReview, canApprove }: { articleId: string; status: string; hasDraft: boolean; hasReview: boolean; canApprove: boolean }) {
  const { run, pending } = useRun();
  const { t } = useI18n();
  const [revising, setRevising] = useState(false);
  const router = useRouter();
  return (
    <div className="flex flex-wrap items-center gap-2">
      {hasDraft && <Button size="sm" variant="secondary" disabled={pending} onClick={() => run(() => submitArticleAction(articleId), t("artf.submittedForReview"))}><Send className="h-3.5 w-3.5" /> {t("artf.submitForReview")}</Button>}
      {hasReview && canApprove && <Button size="sm" variant="primary" disabled={pending} onClick={() => run(() => publishArticleAction(articleId), t("artf.published"))}><BookCheck className="h-3.5 w-3.5" /> {t("artf.approvePublish")}</Button>}
      {hasReview && !canApprove && <span className="text-[12px] text-ink-3">{t("artf.inReview")}</span>}
      {status === "published" && !hasDraft && !hasReview && <Button size="sm" variant="secondary" onClick={() => setRevising(true)}><Pencil className="h-3.5 w-3.5" /> {t("artf.newRevision")}</Button>}
      {status === "published" && <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => markArticleReviewedAction(articleId), t("artf.markedReviewed"))}><CheckCircle2 className="h-3.5 w-3.5" /> {t("artf.markReviewed")}</Button>}
      {status !== "archived" && <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => archiveArticleAction(articleId), t("artf.archived"))}><Archive className="h-3.5 w-3.5" /> {t("orgf.archive")}</Button>}

      <Drawer open={revising} onClose={() => setRevising(false)} title={t("artf.newRevision")} description={t("artf.revisionSub")} width="680px">
        <ActionForm action={createArticleRevisionAction} submitLabel={t("artf.createRevision")} onCancel={() => setRevising(false)} onSuccess={() => { setRevising(false); router.refresh(); }}>
          <input type="hidden" name="articleId" value={articleId} />
          <FormField label={t("artf.title")} name="title"><Input name="title" placeholder={t("artf.phKeepTitle")} /></FormField>
          <FormField label={t("artf.revisedBody")} name="body" required><Textarea name="body" required className="min-h-40" /></FormField>
          <FormField label={t("artf.whatChanged")} name="changeNote"><Input name="changeNote" placeholder={t("artf.phChangedSafety")} /></FormField>
        </ActionForm>
      </Drawer>
    </div>
  );
}

