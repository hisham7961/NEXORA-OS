"use client";

import { useCreateShortcut } from "@/lib/use-create-shortcut";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, HelpCircle, Copy, Check, Send, Stamp, Archive, Pencil } from "lucide-react";
import { Button, Input, Textarea, Select, Drawer } from "@/components/ui";
import { ActionForm, FormField, FormSection } from "@/components/form/action-form";
import { useToast, useI18n } from "@/components/providers";
import { createAnswerDraftAction, createAnswerRequestAction, submitAnswerAction, approveAnswerAction, retireAnswerAction, createRevisionAction, recordAnswerUsageAction } from "@/app/actions/answers";
import type { Option } from "@/domain/options";

const CATEGORIES = ["product_info", "complaint", "usage", "ingredients", "medical", "returns", "shipping", "general"];
const LANGS = ["en", "ar"];

export function NewAnswerButton({ options }: { options: { brands: Option[]; countries: Option[] } }) {
  const [open, setOpen] = useState(false);
  useCreateShortcut(() => setOpen(true));
  const router = useRouter();
  const { t } = useI18n();
  return (
    <>
      <Button variant="primary" size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> {t("ansf.newAnswer")}</Button>
      <Drawer open={open} onClose={() => setOpen(false)} title={t("ansf.newApprovedAnswer")} description={t("ansf.newAnswerSub")} width="620px">
        <ActionForm action={createAnswerDraftAction} submitLabel={t("artf.createDraft")} onCancel={() => setOpen(false)} onSuccess={(d) => { setOpen(false); const id = (d as { id?: string })?.id; if (id) router.push(`/answers/${id}`); }}>
          <FormField label={t("ansf.question")} name="question" required><Input name="question" required placeholder={t("ansf.phQuestion")} /></FormField>
          <FormField label={t("ansf.approvedAnswer")} name="answer" required><Textarea name="answer" required placeholder={t("ansf.phAnswer")} className="min-h-28" /></FormField>
          <FormSection>
            <FormField label={t("common.brand")} name="brandId"><Select name="brandId" defaultValue=""><option value="">{t("wf.allBrands")}</option>{options.brands.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}</Select></FormField>
            <FormField label={t("common.market")} name="countryId"><Select name="countryId" defaultValue=""><option value="">{t("prodf.allMarkets")}</option>{options.countries.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</Select></FormField>
            <FormField label={t("common.category")} name="category"><Select name="category" defaultValue="general">{CATEGORIES.map((c) => <option key={c} value={c}>{c.replace(/_/g, " ")}</option>)}</Select></FormField>
            <FormField label={t("ansf.language")} name="language"><Select name="language" defaultValue="en">{LANGS.map((l) => <option key={l} value={l}>{l.toUpperCase()}</option>)}</Select></FormField>
          </FormSection>
        </ActionForm>
      </Drawer>
    </>
  );
}

export function RequestAnswerButton({ options, variant = "secondary" }: { options: { brands: Option[]; countries: Option[] }; variant?: "secondary" | "ghost" }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { t } = useI18n();
  return (
    <>
      <Button variant={variant} size="sm" onClick={() => setOpen(true)}><HelpCircle className="h-4 w-4" /> {t("ansf.requestAnswer")}</Button>
      <Drawer open={open} onClose={() => setOpen(false)} title={t("ansf.requestAnswerTitle")} description={t("ansf.requestSub")}>
        <ActionForm action={createAnswerRequestAction} submitLabel={t("ansf.submitRequest")} onCancel={() => setOpen(false)} onSuccess={() => { setOpen(false); router.refresh(); }}>
          <FormField label={t("ansf.question")} name="question" required><Input name="question" required placeholder={t("ansf.phNeedAnswered")} /></FormField>
          <FormSection>
            <FormField label={t("common.brand")} name="brandId"><Select name="brandId" defaultValue=""><option value="">—</option>{options.brands.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}</Select></FormField>
            <FormField label={t("common.market")} name="countryId"><Select name="countryId" defaultValue=""><option value="">—</option>{options.countries.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</Select></FormField>
          </FormSection>
          <FormField label={t("ansf.context")} name="context"><Textarea name="context" placeholder={t("ansf.phContext")} className="min-h-16" /></FormField>
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

export function AnswerLifecycle({ answerId, status, hasDraft, hasPending, canApprove }: { answerId: string; status: string; hasDraft: boolean; hasPending: boolean; canApprove: boolean }) {
  const { run, pending } = useRun();
  const { t } = useI18n();
  const [revising, setRevising] = useState(false);
  const router = useRouter();
  return (
    <div className="flex flex-wrap items-center gap-2">
      {hasDraft && <Button size="sm" variant="primary" disabled={pending} onClick={() => run(() => submitAnswerAction(answerId), t("ansf.submittedForApproval"))}><Send className="h-3.5 w-3.5" /> {t("ansf.submitForApproval")}</Button>}
      {hasPending && canApprove && <Button size="sm" variant="primary" disabled={pending} onClick={() => run(() => approveAnswerAction(answerId), t("ansf.approved"))}><Stamp className="h-3.5 w-3.5" /> {t("ansf.approve")}</Button>}
      {hasPending && !canApprove && <span className="text-[12px] text-ink-3">{t("ansf.pendingApproval")}</span>}
      {status === "approved" && !hasDraft && !hasPending && (
        <Button size="sm" variant="secondary" onClick={() => setRevising(true)}><Pencil className="h-3.5 w-3.5" /> {t("ansf.newRevision")}</Button>
      )}
      {status !== "retired" && status !== "draft" && <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => retireAnswerAction(answerId), t("ansf.retired"))}><Archive className="h-3.5 w-3.5" /> {t("ansf.retire")}</Button>}

      <Drawer open={revising} onClose={() => setRevising(false)} title={t("ansf.newRevision")} description={t("ansf.revisionSub")}>
        <ActionForm action={createRevisionAction} submitLabel={t("ansf.createRevision")} onCancel={() => setRevising(false)} onSuccess={() => { setRevising(false); router.refresh(); }}>
          <input type="hidden" name="answerId" value={answerId} />
          <FormField label={t("ansf.revisedAnswer")} name="answer" required><Textarea name="answer" required className="min-h-28" placeholder={t("ansf.phRevisedAnswer")} /></FormField>
          <FormField label={t("artf.whatChanged")} name="changeNote"><Input name="changeNote" placeholder={t("ansf.phChangedDosage")} /></FormField>
        </ActionForm>
      </Drawer>
    </div>
  );
}

export function CopyAnswerButton({ answerId, text, caseId, label }: { answerId: string; text: string; caseId?: string; label?: string }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  return (
    <Button size="sm" variant="secondary" onClick={async () => {
      try { await navigator.clipboard.writeText(text); } catch { /* ignore */ }
      setCopied(true);
      recordAnswerUsageAction(answerId, caseId).catch(() => {});
      setTimeout(() => setCopied(false), 1500);
    }}>
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} {copied ? t("ansf.copied") : (label ?? t("ansf.copy"))}
    </Button>
  );
}
