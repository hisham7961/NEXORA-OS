"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { LogIn, Coffee, Play, LogOut } from "lucide-react";
import { Button, Badge } from "@/components/ui";
import { useToast, useI18n } from "@/components/providers";
import { checkInAction, startBreakAction, endBreakAction, checkOutAction } from "@/app/actions/attendance";
import type { ActionResult } from "@/lib/action";

type State = "out" | "working" | "on_break" | "checked_out";

const LABEL: Record<State, { key: string; tone: "neutral" | "success" | "warning" | "info" }> = {
  out: { key: "clk.notCheckedIn", tone: "neutral" },
  working: { key: "clk.working", tone: "success" },
  on_break: { key: "clk.onBreak", tone: "warning" },
  checked_out: { key: "clk.checkedOutState", tone: "info" },
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
  const { t } = useI18n();
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
      <Badge category={label.tone} dot>{t(label.key)}</Badge>
      {startedAt && <span className="text-xs text-ink-3">{t("clk.since", { time: startedAt })}</span>}
      {state === "checked_out" && typeof workedMinutes === "number" && (
        <span className="text-xs text-ink-3 tabular">{t("clk.worked", { h: Math.floor(workedMinutes / 60), m: workedMinutes % 60 })}</span>
      )}
      <div className="ms-auto flex items-center gap-2">
        {state === "out" && <Button variant="primary" disabled={pending} onClick={() => run(checkInAction, t("clk.checkedIn"))}><LogIn className="h-4 w-4" /> {t("clk.checkIn")}</Button>}
        {state === "working" && (
          <>
            <Button variant="secondary" disabled={pending} onClick={() => run(startBreakAction, t("clk.breakStarted"))}><Coffee className="h-4 w-4" /> {t("clk.break")}</Button>
            <Button variant="primary" disabled={pending} onClick={() => run(checkOutAction, t("clk.checkedOut"))}><LogOut className="h-4 w-4" /> {t("clk.checkOut")}</Button>
          </>
        )}
        {state === "on_break" && <Button variant="primary" disabled={pending} onClick={() => run(endBreakAction, t("clk.backToWork"))}><Play className="h-4 w-4" /> {t("clk.backToWork")}</Button>}
      </div>
    </div>
  );
}
