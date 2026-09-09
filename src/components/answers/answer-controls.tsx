"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, HelpCircle, Copy, Check, Send, Stamp, Archive, Pencil } from "lucide-react";
import { Button, Input, Textarea, Select, Drawer } from "@/components/ui";
import { ActionForm, FormField, FormSection } from "@/components/form/action-form";
import { useToast } from "@/components/providers";
import { createAnswerDraftAction, createAnswerRequestAction, submitAnswerAction, approveAnswerAction, retireAnswerAction, createRevisionAction, recordAnswerUsageAction } from "@/app/actions/answers";
import type { Option } from "@/domain/options";

const CATEGORIES = ["product_info", "complaint", "usage", "ingredients", "medical", "returns", "shipping", "general"];
const LANGS = ["en", "ar"];

export function NewAnswerButton({ options }: { options: { brands: Option[]; countries: Option[] } }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  return (
    <>
      <Button variant="primary" size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> New answer</Button>
      <Drawer open={open} onClose={() => setOpen(false)} title="New approved answer" description="Drafts require approval before agents can use them." width="620px">
        <ActionForm action={createAnswerDraftAction} submitLabel="Create draft" onCancel={() => setOpen(false)} onSuccess={(d) => { setOpen(false); const id = (d as { id?: string })?.id; if (id) router.push(`/answers/${id}`); }}>
          <FormField label="Question" name="question" required><Input name="question" required placeholder="What customers ask…" /></FormField>
          <FormField label="Approved answer" name="answer" required><Textarea name="answer" required placeholder="The official response…" className="min-h-28" /></FormField>
          <FormSection>
            <FormField label="Brand" name="brandId"><Select name="brandId" defaultValue=""><option value="">All brands</option>{options.brands.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}</Select></FormField>
            <FormField label="Market" name="countryId"><Select name="countryId" defaultValue=""><option value="">All markets</option>{options.countries.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</Select></FormField>
            <FormField label="Category" name="category"><Select name="category" defaultValue="general">{CATEGORIES.map((c) => <option key={c} value={c}>{c.replace(/_/g, " ")}</option>)}</Select></FormField>
            <FormField label="Language" name="language"><Select name="language" defaultValue="en">{LANGS.map((l) => <option key={l} value={l}>{l.toUpperCase()}</option>)}</Select></FormField>
          </FormSection>
        </ActionForm>
      </Drawer>
    </>
  );
}

export function RequestAnswerButton({ options, variant = "secondary" }: { options: { brands: Option[]; countries: Option[] }; variant?: "secondary" | "ghost" }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  return (
    <>
      <Button variant={variant} size="sm" onClick={() => setOpen(true)}><HelpCircle className="h-4 w-4" /> Request answer</Button>
      <Drawer open={open} onClose={() => setOpen(false)} title="Request a new answer" description="Ask management/medical to prepare an official response.">
        <ActionForm action={createAnswerRequestAction} submitLabel="Submit request" onCancel={() => setOpen(false)} onSuccess={() => { setOpen(false); router.refresh(); }}>
          <FormField label="Question" name="question" required><Input name="question" required placeholder="What do you need answered?" /></FormField>
          <FormSection>
            <FormField label="Brand" name="brandId"><Select name="brandId" defaultValue=""><option value="">—</option>{options.brands.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}</Select></FormField>
            <FormField label="Market" name="countryId"><Select name="countryId" defaultValue=""><option value="">—</option>{options.countries.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</Select></FormField>
          </FormSection>
          <FormField label="Context" name="context"><Textarea name="context" placeholder="Any context that helps prepare the answer…" className="min-h-16" /></FormField>
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

export function AnswerLifecycle({ answerId, status, hasDraft, hasPending, canApprove }: { answerId: string; status: string; hasDraft: boolean; hasPending: boolean; canApprove: boolean }) {
  const { run, pending } = useRun();
  const [revising, setRevising] = useState(false);
  const router = useRouter();
  return (
    <div className="flex flex-wrap items-center gap-2">
      {hasDraft && <Button size="sm" variant="primary" disabled={pending} onClick={() => run(() => submitAnswerAction(answerId), "Submitted for approval")}><Send className="h-3.5 w-3.5" /> Submit for approval</Button>}
      {hasPending && canApprove && <Button size="sm" variant="primary" disabled={pending} onClick={() => run(() => approveAnswerAction(answerId), "Approved")}><Stamp className="h-3.5 w-3.5" /> Approve</Button>}
      {hasPending && !canApprove && <span className="text-[12px] text-ink-3">Pending approval by an authorized approver.</span>}
      {status === "approved" && !hasDraft && !hasPending && (
        <Button size="sm" variant="secondary" onClick={() => setRevising(true)}><Pencil className="h-3.5 w-3.5" /> New revision</Button>
      )}
      {status !== "retired" && status !== "draft" && <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => retireAnswerAction(answerId), "Retired")}><Archive className="h-3.5 w-3.5" /> Retire</Button>}

      <Drawer open={revising} onClose={() => setRevising(false)} title="New revision" description="Creates a new draft version; the current approved answer stays live until this is approved.">
        <ActionForm action={createRevisionAction} submitLabel="Create revision" onCancel={() => setRevising(false)} onSuccess={() => { setRevising(false); router.refresh(); }}>
          <input type="hidden" name="answerId" value={answerId} />
          <FormField label="Revised answer" name="answer" required><Textarea name="answer" required className="min-h-28" placeholder="Updated official response…" /></FormField>
          <FormField label="What changed" name="changeNote"><Input name="changeNote" placeholder="e.g. updated dosage guidance" /></FormField>
        </ActionForm>
      </Drawer>
    </div>
  );
}

export function CopyAnswerButton({ answerId, text, caseId, label = "Copy" }: { answerId: string; text: string; caseId?: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button size="sm" variant="secondary" onClick={async () => {
      try { await navigator.clipboard.writeText(text); } catch { /* ignore */ }
      setCopied(true);
      recordAnswerUsageAction(answerId, caseId).catch(() => {});
      setTimeout(() => setCopied(false), 1500);
    }}>
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} {copied ? "Copied" : label}
    </Button>
  );
}
