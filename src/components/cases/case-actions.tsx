"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Select, Textarea } from "@/components/ui";
import { useToast, useI18n } from "@/components/providers";
import { setCaseStatusAction, assignCaseAction, addCaseNoteAction } from "@/app/actions/cases";
import type { Option } from "@/domain/options";
import type { ActionResult } from "@/lib/action";

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

const TRANSITIONS: { status: string; labelKey: string; variant?: "primary" | "secondary" | "danger" }[] = [
  { status: "in_progress", labelKey: "caseb.start" },
  { status: "waiting", labelKey: "caseb.waiting" },
  { status: "escalated", labelKey: "caseb.escalate", variant: "danger" },
  { status: "resolved", labelKey: "caseb.resolve", variant: "primary" },
  { status: "closed", labelKey: "caseb.close" },
];

export function CaseActionBar({ caseId, status, users, assignedToId }: { caseId: string; status: string; users: Option[]; assignedToId: string | null }) {
  const { run, pending } = useRun();
  const { t } = useI18n();
  const [note, setNote] = useState("");
  const [internal, setInternal] = useState(true);
  const isClosed = status === "resolved" || status === "closed";

  return (
    <div className="space-y-4">
      <div>
        <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-3">{t("common.status")}</div>
        <div className="flex flex-wrap gap-2">
          {isClosed ? (
            <Button variant="secondary" size="sm" disabled={pending} onClick={() => run(() => setCaseStatusAction(caseId, "in_progress"), t("caseb.reopened"))}>{t("caseb.reopen")}</Button>
          ) : (
            TRANSITIONS.filter((tr) => tr.status !== status).map((tr) => (
              <Button key={tr.status} variant={tr.variant ?? "secondary"} size="sm" disabled={pending} onClick={() => run(() => setCaseStatusAction(caseId, tr.status), t("common.movedTo", { status: t(tr.labelKey) }))}>
                {t(tr.labelKey)}
              </Button>
            ))
          )}
        </div>
      </div>

      <div>
        <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-3">{t("caseb.assignedTo")}</div>
        <Select value={assignedToId ?? ""} disabled={pending} onChange={(e) => run(() => assignCaseAction(caseId, e.target.value), t("caseb.reassigned"))} className="w-56">
          <option value="">{t("caseb.unassigned")}</option>
          {users.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}
        </Select>
      </div>

      <div>
        <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-3">{t("caseb.addNote")}</div>
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("caseb.notePlaceholder")} className="min-h-16" />
        <div className="mt-2 flex items-center justify-between">
          <label className="flex items-center gap-2 text-xs text-ink-2">
            <input type="checkbox" checked={internal} onChange={(e) => setInternal(e.target.checked)} className="accent-[var(--accent)]" /> {t("caseb.internalOnly")}
          </label>
          <Button
            variant="primary"
            size="sm"
            disabled={pending || !note.trim()}
            onClick={() =>
              run(async () => {
                const res = await addCaseNoteAction(caseId, note.trim(), internal);
                if (res.ok) setNote("");
                return res;
              }, t("caseb.noteAdded"))
            }
          >
            {t("caseb.addNote")}
          </Button>
        </div>
      </div>
    </div>
  );
}
