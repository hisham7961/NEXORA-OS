"use server";

import { revalidatePath } from "next/cache";
import { runAction, type ActionResult } from "@/lib/action";
import * as Att from "@/domain/attendance";

async function clock(fn: (ctx: Parameters<typeof Att.checkIn>[0]) => Promise<void>): Promise<ActionResult> {
  const res = await runAction((ctx) => fn(ctx));
  if (res.ok) {
    revalidatePath("/attendance");
    revalidatePath("/my-day");
  }
  return res;
}

export async function checkInAction(): Promise<ActionResult> {
  return clock(Att.checkIn);
}
export async function startBreakAction(): Promise<ActionResult> {
  return clock(Att.startBreak);
}
export async function endBreakAction(): Promise<ActionResult> {
  return clock(Att.endBreak);
}
export async function checkOutAction(): Promise<ActionResult> {
  return clock(Att.checkOut);
}

export async function requestCorrectionAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const { str } = await import("@/lib/action");
  const res = await runAction((ctx) => Att.requestAttendanceCorrection(ctx, {
    date: str(fd, "date"), type: str(fd, "type"), reason: str(fd, "reason"), field: str(fd, "field"), requestedValue: str(fd, "requestedValue"),
  }));
  if (res.ok) revalidatePath("/attendance");
  return res;
}

export async function decideCorrectionAction(id: string, decision: "approved" | "rejected" | "changes_requested", note?: string): Promise<ActionResult> {
  const res = await runAction((ctx) => Att.decideAttendanceCorrection(ctx, id, decision, note));
  if (res.ok) revalidatePath("/attendance");
  return res;
}
