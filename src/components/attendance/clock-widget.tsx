"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { LogIn, Coffee, Play, LogOut } from "lucide-react";
import { Button, Badge } from "@/components/ui";
import { useToast } from "@/components/providers";
import { checkInAction, startBreakAction, endBreakAction, checkOutAction } from "@/app/actions/attendance";
import type { ActionResult } from "@/lib/action";

type State = "out" | "working" | "on_break" | "checked_out";

const LABEL: Record<State, { text: string; tone: "neutral" | "success" | "warning" | "info" }> = {
  out: { text: "Not checked in", tone: "neutral" },
  working: { text: "Working", tone: "success" },
  on_break: { text: "On break", tone: "warning" },
  checked_out: { text: "Checked out", tone: "info" },
};

export function ClockWidget({
  state,
  startedAt,
  workedMinutes,
}: {
  state: State;
  startedAt?: string | null;
  workedMinutes?: number | null;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();

  const run = (fn: () => Promise<ActionResult>, ok: string) =>
    start(async () => {
      const res = await fn();
      if (res.ok) {
        toast({ kind: "success", title: ok });
        router.refresh();
      } else toast({ kind: "error", title: res.error });
    });

  const label = LABEL[state];

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Badge category={label.tone} dot>{label.text}</Badge>
      {startedAt && <span className="text-xs text-ink-3">Since {startedAt}</span>}
      {state === "checked_out" && typeof workedMinutes === "number" && (
        <span className="text-xs text-ink-3 tabular">{Math.floor(workedMinutes / 60)}h {workedMinutes % 60}m worked</span>
      )}
      <div className="ms-auto flex items-center gap-2">
        {state === "out" && <Button variant="primary" disabled={pending} onClick={() => run(checkInAction, "Checked in")}><LogIn className="h-4 w-4" /> Check in</Button>}
        {state === "working" && (
          <>
            <Button variant="secondary" disabled={pending} onClick={() => run(startBreakAction, "Break started")}><Coffee className="h-4 w-4" /> Break</Button>
            <Button variant="primary" disabled={pending} onClick={() => run(checkOutAction, "Checked out")}><LogOut className="h-4 w-4" /> Check out</Button>
          </>
        )}
        {state === "on_break" && <Button variant="primary" disabled={pending} onClick={() => run(endBreakAction, "Back to work")}><Play className="h-4 w-4" /> Back to work</Button>}
      </div>
    </div>
  );
}
