"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button, Select, Input, Textarea } from "@/components/ui";
import { useToast } from "@/components/providers";
import { changeStageAction, addRequirementAction, setRequirementStatusAction, recordAuthorityResponseAction } from "@/app/actions/registrations";
import type { ActionResult } from "@/lib/action";
import { humanize } from "@/lib/status";

const STAGES = ["preparation", "documents_missing", "ready_submission", "submitted", "authority_review", "additional_requirements", "samples_requested", "payment_required", "approved", "rejected", "registered", "renewal_required", "expired"];
const REQ_STATUSES = ["required", "received", "submitted", "missing"];

function useRun() {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<ActionResult>, ok?: string) =>
    start(async () => {
      const res = await fn();
      if (res.ok) {
        if (ok) toast({ kind: "success", title: ok });
        router.refresh();
      } else toast({ kind: "error", title: res.error });
    });
  return { run, pending };
}

export function RegistrationActions({ caseId, status, requirements }: { caseId: string; status: string; requirements: { id: string; name: string; status: string }[] }) {
  const { run, pending } = useRun();
  const [reqName, setReqName] = useState("");
  const [response, setResponse] = useState("");

  return (
    <div className="space-y-5">
      <div>
        <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-3">Workflow stage</div>
        <Select value={status} disabled={pending} onChange={(e) => run(() => changeStageAction(caseId, e.target.value), `Moved to ${humanize(e.target.value)}`)} className="w-full">
          {STAGES.map((s) => <option key={s} value={s}>{humanize(s)}</option>)}
        </Select>
      </div>

      <div>
        <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-3">Required documents</div>
        <ul className="space-y-1.5">
          {requirements.map((r) => (
            <li key={r.id} className="flex items-center gap-2">
              <span className="flex-1 text-[13px] text-ink">{r.name}</span>
              <Select value={r.status} disabled={pending} onChange={(e) => run(() => setRequirementStatusAction(caseId, r.id, e.target.value), "Updated")} className="h-8 w-32">
                {REQ_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </Select>
            </li>
          ))}
          {requirements.length === 0 && <li className="text-xs text-ink-3">No requirements yet.</li>}
        </ul>
        <div className="mt-2 flex items-center gap-2">
          <Input value={reqName} onChange={(e) => setReqName(e.target.value)} placeholder="Add required document…" className="h-8" />
          <Button variant="secondary" size="sm" disabled={pending || !reqName.trim()} onClick={() => run(async () => { const res = await addRequirementAction(caseId, reqName.trim()); if (res.ok) setReqName(""); return res; }, "Requirement added")}>
            <Plus className="h-3.5 w-3.5" /> Add
          </Button>
        </div>
      </div>

      <div>
        <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-3">Record authority response</div>
        <Textarea value={response} onChange={(e) => setResponse(e.target.value)} placeholder="What did the authority say?" className="min-h-16" />
        <div className="mt-2 flex justify-end">
          <Button variant="primary" size="sm" disabled={pending || !response.trim()} onClick={() => run(async () => { const res = await recordAuthorityResponseAction(caseId, response.trim()); if (res.ok) setResponse(""); return res; }, "Response recorded")}>
            Record
          </Button>
        </div>
      </div>
    </div>
  );
}
