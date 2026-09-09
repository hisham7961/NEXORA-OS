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

export const checkInAction = () => clock(Att.checkIn);
export const startBreakAction = () => clock(Att.startBreak);
export const endBreakAction = () => clock(Att.endBreak);
export const checkOutAction = () => clock(Att.checkOut);
