"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Send, BookCheck, Archive, CheckCircle2 } from "lucide-react";
import { Button, Input, Textarea, Select, Drawer } from "@/components/ui";
import { ActionForm, FormField, FormSection } from "@/components/form/action-form";
import { useToast } from "@/components/providers";
import { createArticleAction, updateArticleAction, createArticleRevisionAction, submitArticleAction, publishArticleAction, archiveArticleAction, markArticleReviewedAction } from "@/app/actions/knowledge";
import type { Option } from "@/domain/options";

const CATEGORIES = ["sop", "company_policy", "brand_info", "product_info", "marketing", "customer_service", "regulatory", "commerce", "creative", "hr_ops", "custom"];

function TagsInput({ initial = "" }: { initial?: string }) {
  const [raw, setRaw] = useState(initial);
  const tags = raw.split(",").map((t) => t.trim()).filter(Boolean);
  return (<><Input value={raw} onChange={(e) => setRaw(e.target.value)} placeholder="e.g. onboarding, safety" />{tags.map((t) => <input key={t} type="hidden" name="tags" value={t} />)}</>);
}

export function NewArticleButton({ options }: { options: { brands: Option[]; countries: Option[]; users: Option[] } }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  return (
    <>
      <Button variant="primary" size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> New article</Button>
      <Drawer open={open} onClose={() => setOpen(false)} title="New knowledge article" description="Drafts go through review before publishing." width="680px">
        <ActionForm action={createArticleAction} submitLabel="Create draft" onCancel={() => setOpen(false)} onSuccess={(d) => { setOpen(false); const id = (d as { id?: string })?.id; if (id) router.push(`/knowledge/${id}`); }}>
          <FormField label="Title" name="title" required><Input name="title" required placeholder="Article title" /></FormField>
          <FormField label="Body" name="body" required><Textarea name="body" required className="min-h-40" placeholder="Write the article…" /></FormField>
          <FormSection>
            <FormField label="Category" name="category"><Select name="category" defaultValue="sop">{CATEGORIES.map((c) => <option key={c} value={c}>{c.replace(/_/g, " ")}</option>)}</Select></FormField>
            <FormField label="Brand" name="brandId"><Select name="brandId" defaultValue=""><option value="">All brands</option>{options.brands.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}</Select></FormField>
            <FormField label="Reviewer" name="reviewerId"><Select name="reviewerId" defaultValue=""><option value="">—</option>{options.users.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}</Select></FormField>
            <FormField label="Next review due" name="reviewDueAt"><Input type="date" name="reviewDueAt" /></FormField>
          </FormSection>
          <FormField label="Tags" name="tags" hint="Comma-separated"><TagsInput /></FormField>
        </ActionForm>
      </Drawer>
    </>
  );
}

export function EditDraftButton({ article }: { article: { id: string; title: string; category: string | null; tags: string[]; draftBody: string } }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}><Pencil className="h-4 w-4" /> Edit draft</Button>
      <Drawer open={open} onClose={() => setOpen(false)} title="Edit draft" description="Only affects the working draft version." width="680px">
        <ActionForm action={updateArticleAction} submitLabel="Save draft" onCancel={() => setOpen(false)} onSuccess={() => { setOpen(false); router.refresh(); }}>
          <input type="hidden" name="articleId" value={article.id} />
          <FormField label="Title" name="title" required><Input name="title" defaultValue={article.title} required /></FormField>
          <FormField label="Body" name="body" required><Textarea name="body" defaultValue={article.draftBody} required className="min-h-40" /></FormField>
          <FormSection>
            <FormField label="Category" name="category"><Select name="category" defaultValue={article.category ?? "sop"}>{CATEGORIES.map((c) => <option key={c} value={c}>{c.replace(/_/g, " ")}</option>)}</Select></FormField>
          </FormSection>
          <FormField label="Tags" name="tags" hint="Comma-separated"><TagsInput initial={article.tags.join(", ")} /></FormField>
        </ActionForm>
      </Drawer>
    </>
  );
}

function useRun() {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, ok?: string) =>
    start(async () => { const r = await fn(); if (r.ok) { if (ok) toast({ kind: "success", title: ok }); router.refresh(); } else toast({ kind: "error", title: r.error ?? "Failed" }); });
  return { run, pending };
}

export function ArticleLifecycle({ articleId, status, hasDraft, hasReview, canApprove }: { articleId: string; status: string; hasDraft: boolean; hasReview: boolean; canApprove: boolean }) {
  const { run, pending } = useRun();
  const [revising, setRevising] = useState(false);
  const router = useRouter();
  return (
    <div className="flex flex-wrap items-center gap-2">
      {hasDraft && <Button size="sm" variant="secondary" disabled={pending} onClick={() => run(() => submitArticleAction(articleId), "Submitted for review")}><Send className="h-3.5 w-3.5" /> Submit for review</Button>}
      {hasReview && canApprove && <Button size="sm" variant="primary" disabled={pending} onClick={() => run(() => publishArticleAction(articleId), "Published")}><BookCheck className="h-3.5 w-3.5" /> Approve & publish</Button>}
      {hasReview && !canApprove && <span className="text-[12px] text-ink-3">In review — awaiting an approver.</span>}
      {status === "published" && !hasDraft && !hasReview && <Button size="sm" variant="secondary" onClick={() => setRevising(true)}><Pencil className="h-3.5 w-3.5" /> New revision</Button>}
      {status === "published" && <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => markArticleReviewedAction(articleId), "Marked reviewed")}><CheckCircle2 className="h-3.5 w-3.5" /> Mark reviewed</Button>}
      {status !== "archived" && <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => archiveArticleAction(articleId), "Archived")}><Archive className="h-3.5 w-3.5" /> Archive</Button>}

      <Drawer open={revising} onClose={() => setRevising(false)} title="New revision" description="Creates a new draft; the published article stays live until this revision is published." width="680px">
        <ActionForm action={createArticleRevisionAction} submitLabel="Create revision" onCancel={() => setRevising(false)} onSuccess={() => { setRevising(false); router.refresh(); }}>
          <input type="hidden" name="articleId" value={articleId} />
          <FormField label="Title" name="title"><Input name="title" placeholder="(leave blank to keep the current title)" /></FormField>
          <FormField label="Revised body" name="body" required><Textarea name="body" required className="min-h-40" /></FormField>
          <FormField label="What changed" name="changeNote"><Input name="changeNote" placeholder="e.g. updated safety steps" /></FormField>
        </ActionForm>
      </Drawer>
    </div>
  );
}

