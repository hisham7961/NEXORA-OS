"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button, Select, Input, Textarea } from "@/components/ui";
import { useToast, useI18n } from "@/components/providers";
import { changeStageAction, addRequirementAction, setRequirementStatusAction, recordAuthorityResponseAction } from "@/app/actions/registrations";
import type { ActionResult } from "@/lib/action";

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
  const { t } = useI18n();
  const [reqName, setReqName] = useState("");
  const [response, setResponse] = useState("");

  return (
    <div className="space-y-5">
      <div>
        <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-3">{t("regb.workflowStage")}</div>
        <Select value={status} disabled={pending} onChange={(e) => run(() => changeStageAction(caseId, e.target.value), t("common.movedTo", { status: t(`status.${e.target.value}`) }))} className="w-full">
          {STAGES.map((s) => <option key={s} value={s}>{t(`status.${s}`)}</option>)}
        </Select>
      </div>

      <div>
        <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-3">{t("regb.requiredDocuments")}</div>
        <ul className="space-y-1.5">
          {requirements.map((r) => (
            <li key={r.id} className="flex items-center gap-2">
              <span className="flex-1 text-[13px] text-ink">{r.name}</span>
              <Select value={r.status} disabled={pending} onChange={(e) => run(() => setRequirementStatusAction(caseId, r.id, e.target.value), t("regb.updated"))} className="h-8 w-32">
                {REQ_STATUSES.map((s) => <option key={s} value={s}>{t(`status.${s}`)}</option>)}
              </Select>
            </li>
          ))}
          {requirements.length === 0 && <li className="text-xs text-ink-3">{t("regb.noRequirements")}</li>}
        </ul>
        <div className="mt-2 flex items-center gap-2">
          <Input value={reqName} onChange={(e) => setReqName(e.target.value)} placeholder={t("regb.addRequiredDoc")} className="h-8" />
          <Button variant="secondary" size="sm" disabled={pending || !reqName.trim()} onClick={() => run(async () => { const res = await addRequirementAction(caseId, reqName.trim()); if (res.ok) setReqName(""); return res; }, t("regb.requirementAdded"))}>
            <Plus className="h-3.5 w-3.5" /> {t("common.add")}
          </Button>
        </div>
      </div>

      <div>
        <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-3">{t("regb.recordAuthorityResponse")}</div>
        <Textarea value={response} onChange={(e) => setResponse(e.target.value)} placeholder={t("regb.authorityPlaceholder")} className="min-h-16" />
        <div className="mt-2 flex justify-end">
          <Button variant="primary" size="sm" disabled={pending || !response.trim()} onClick={() => run(async () => { const res = await recordAuthorityResponseAction(caseId, response.trim()); if (res.ok) setResponse(""); return res; }, t("regb.responseRecorded"))}>
            {t("regb.record")}
          </Button>
        </div>
      </div>
    </div>
  );
}
