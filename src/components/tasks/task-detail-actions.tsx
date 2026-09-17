"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Plus, Archive } from "lucide-react";
import { Select, Input, Button } from "@/components/ui";
import { useToast, useI18n } from "@/components/providers";
import { setTaskStatusAction, toggleChecklistItemAction, addChecklistItemAction, archiveTaskAction } from "@/app/actions/tasks";
import type { ActionResult } from "@/lib/action";

const STATUSES = ["backlog", "todo", "in_progress", "blocked", "waiting", "review", "completed", "cancelled"];

function useAction() {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<ActionResult>, ok?: string) =>
    start(async () => {
      const res = await fn();
      if (res.ok) {
        if (ok) toast({ kind: "success", title: ok });
        router.refresh();
      } else {
        toast({ kind: "error", title: res.error });
      }
    });
  return { run, pending };
}

export function StatusControl({ taskId, status }: { taskId: string; status: string }) {
  const { run, pending } = useAction();
  const { t } = useI18n();
  return (
    <Select
      value={status}
      disabled={pending}
      onChange={(e) => run(() => setTaskStatusAction(taskId, e.target.value))}
      className="w-40"
      aria-label={t("tda.changeStatus")}
    >
      {STATUSES.map((s) => <option key={s} value={s}>{t(`status.${s}`)}</option>)}
    </Select>
  );
}

export function ChecklistPanel({ taskId, items }: { taskId: string; items: { id: string; text: string; isDone: boolean }[] }) {
  const { run, pending } = useAction();
  const { t } = useI18n();
  const [draft, setDraft] = useState("");
  const done = items.filter((i) => i.isDone).length;

  return (
    <div>
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-3">{t("tda.checklist", { done, total: items.length })}</div>
      <ul className="space-y-1.5">
        {items.map((c) => (
          <li key={c.id} className="flex items-center gap-2 text-[13px]">
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => toggleChecklistItemAction(taskId, c.id, !c.isDone))}
              className={`flex h-4 w-4 items-center justify-center rounded border ${c.isDone ? "border-success bg-success text-white" : "border-line-strong hover:border-accent"}`}
              aria-label={c.isDone ? t("tda.markIncomplete") : t("tda.markComplete")}
            >
              {c.isDone && <Check className="h-3 w-3" />}
            </button>
            <span className={c.isDone ? "text-ink-3 line-through" : "text-ink"}>{c.text}</span>
          </li>
        ))}
      </ul>
      <div className="mt-2 flex items-center gap-2">
        <Input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={t("tda.addItem")} onKeyDown={(e) => { if (e.key === "Enter" && draft.trim()) { e.preventDefault(); run(() => addChecklistItemAction(taskId, draft.trim())); setDraft(""); } }} />
        <Button type="button" variant="secondary" size="sm" disabled={pending || !draft.trim()} onClick={() => { run(() => addChecklistItemAction(taskId, draft.trim())); setDraft(""); }}>
          <Plus className="h-3.5 w-3.5" /> {t("common.add")}
        </Button>
      </div>
    </div>
  );
}

export function ArchiveTaskButton({ taskId }: { taskId: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const { t } = useI18n();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await archiveTaskAction(taskId);
          if (res.ok) {
            toast({ kind: "success", title: t("tda.taskArchived") });
            router.push("/tasks");
          } else toast({ kind: "error", title: res.error });
        })
      }
    >
      <Archive className="h-4 w-4" /> {t("common.archive")}
    </Button>
  );
}
