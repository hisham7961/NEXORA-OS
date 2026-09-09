"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Select, Textarea } from "@/components/ui";
import { useToast } from "@/components/providers";
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

const TRANSITIONS: { status: string; label: string; variant?: "primary" | "secondary" | "danger" }[] = [
  { status: "in_progress", label: "Start" },
  { status: "waiting", label: "Waiting" },
  { status: "escalated", label: "Escalate", variant: "danger" },
  { status: "resolved", label: "Resolve", variant: "primary" },
  { status: "closed", label: "Close" },
];

export function CaseActionBar({ caseId, status, users, assignedToId }: { caseId: string; status: string; users: Option[]; assignedToId: string | null }) {
  const { run, pending } = useRun();
  const [note, setNote] = useState("");
  const [internal, setInternal] = useState(true);
  const isClosed = status === "resolved" || status === "closed";

  return (
    <div className="space-y-4">
      <div>
        <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-3">Status</div>
        <div className="flex flex-wrap gap-2">
          {isClosed ? (
            <Button variant="secondary" size="sm" disabled={pending} onClick={() => run(() => setCaseStatusAction(caseId, "in_progress"), "Reopened")}>Reopen</Button>
          ) : (
            TRANSITIONS.filter((t) => t.status !== status).map((t) => (
              <Button key={t.status} variant={t.variant ?? "secondary"} size="sm" disabled={pending} onClick={() => run(() => setCaseStatusAction(caseId, t.status), `Moved to ${t.label}`)}>
                {t.label}
              </Button>
            ))
          )}
        </div>
      </div>

      <div>
        <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-3">Assigned to</div>
        <Select value={assignedToId ?? ""} disabled={pending} onChange={(e) => run(() => assignCaseAction(caseId, e.target.value), "Reassigned")} className="w-56">
          <option value="">Unassigned</option>
          {users.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}
        </Select>
      </div>

      <div>
        <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-3">Add note</div>
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Internal note or customer reply…" className="min-h-16" />
        <div className="mt-2 flex items-center justify-between">
          <label className="flex items-center gap-2 text-xs text-ink-2">
            <input type="checkbox" checked={internal} onChange={(e) => setInternal(e.target.checked)} className="accent-[var(--accent)]" /> Internal only
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
              }, "Note added")
            }
          >
            Add note
          </Button>
        </div>
      </div>
    </div>
  );
}
