import { prisma } from "@/lib/db";
import type { Principal } from "@/lib/permissions/engine";
import { ServiceError } from "@/lib/api/handler";
import { audit, type ActorContext } from "@/domain/mutation";

/** Attendance overview (§22) — accountability, not surveillance. */
export async function getAttendanceToday(_principal: Principal) {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = new Date(startOfToday.getTime() + 86_400_000);

  const records = await prisma.attendanceRecord.findMany({ where: { date: { gte: startOfToday, lt: endOfToday } } });
  const userIds = [...new Set(records.map((r) => r.userId))];
  const users = userIds.length ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, avatarColor: true } }) : [];
  const userMap = new Map(users.map((u) => [u.id, u]));

  const rows = records.map((r) => ({ ...r, user: userMap.get(r.userId) ?? { name: "—", avatarColor: null } }));
  const summary = {
    present: records.filter((r) => r.status === "present").length,
    late: records.filter((r) => r.status === "late").length,
    absent: records.filter((r) => r.status === "absent").length,
    leave: records.filter((r) => r.status === "leave").length,
  };
  return { rows, summary };
}

// ---------------------------------------------------------------------------
// CLOCK STATE MACHINE (§22, Phase 2 Part S) — check in → (break/back) → check out.
// Transitions are validated: you cannot check out before checking in, end a break
// with none active, break twice, or check in twice. Durations are computed.
// ---------------------------------------------------------------------------

export type ClockState = "out" | "working" | "on_break" | "checked_out";

function startOfDay(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
const mins = (a: Date, b: Date) => Math.max(0, Math.round((a.getTime() - b.getTime()) / 60000));

function deriveState(record: { actualStart: Date | null; actualEnd: Date | null } | null, events: { type: string; at: Date }[]): ClockState {
  if (!record?.actualStart) return "out";
  if (record.actualEnd) return "checked_out";
  let onBreak = false;
  for (const e of [...events].sort((a, b) => a.at.getTime() - b.at.getTime())) {
    if (e.type === "break_start") onBreak = true;
    else if (e.type === "break_end") onBreak = false;
  }
  return onBreak ? "on_break" : "working";
}

/** The current user's today record + derived clock state (for the clock widget). */
export async function getMyAttendanceToday(principal: Principal) {
  const date = startOfDay();
  const record = await prisma.attendanceRecord.findUnique({ where: { userId_date: { userId: principal.userId, date } } });
  const events = await prisma.attendanceEvent.findMany({ where: { userId: principal.userId, at: { gte: date } }, orderBy: { at: "asc" } });
  return { record, events, state: deriveState(record, events) };
}

async function loadToday(userId: string) {
  const date = startOfDay();
  const record = await prisma.attendanceRecord.findUnique({ where: { userId_date: { userId, date } } });
  const events = await prisma.attendanceEvent.findMany({ where: { userId, at: { gte: date } }, orderBy: { at: "asc" } });
  return { date, record, events, state: deriveState(record, events) };
}

export async function checkIn(ctx: ActorContext): Promise<void> {
  const { date, record, state } = await loadToday(ctx.principal.userId);
  if (state !== "out") throw new ServiceError("already_in", "You are already checked in today.", 409);
  const now = new Date();
  const expectedStart = record?.expectedStart ?? null;
  const lateMinutes = expectedStart ? mins(now, expectedStart) : 0;

  await prisma.attendanceRecord.upsert({
    where: { userId_date: { userId: ctx.principal.userId, date } },
    create: { userId: ctx.principal.userId, date, actualStart: now, status: lateMinutes > 0 ? "late" : "present", lateMinutes },
    update: { actualStart: now, status: lateMinutes > 0 ? "late" : "present", lateMinutes },
  });
  await prisma.attendanceEvent.create({ data: { userId: ctx.principal.userId, type: "check_in", at: now, ip: ctx.ip ?? null } });
  await audit(ctx, { action: "attendance.check_in", entityType: "AttendanceRecord", entityId: ctx.principal.userId, summary: lateMinutes > 0 ? `Checked in (${lateMinutes}m late)` : "Checked in" });
}

export async function startBreak(ctx: ActorContext): Promise<void> {
  const { state } = await loadToday(ctx.principal.userId);
  if (state !== "working") throw new ServiceError("bad_transition", "You can only start a break while working.", 409);
  await prisma.attendanceEvent.create({ data: { userId: ctx.principal.userId, type: "break_start", at: new Date(), ip: ctx.ip ?? null } });
  await audit(ctx, { action: "attendance.break_start", entityType: "AttendanceRecord", entityId: ctx.principal.userId, summary: "Break started" });
}

export async function endBreak(ctx: ActorContext): Promise<void> {
  const { date, record, events, state } = await loadToday(ctx.principal.userId);
  if (state !== "on_break") throw new ServiceError("bad_transition", "There is no active break to end.", 409);
  const lastStart = [...events].reverse().find((e) => e.type === "break_start")!;
  const now = new Date();
  const dur = mins(now, lastStart.at);
  await prisma.$transaction([
    prisma.attendanceEvent.create({ data: { userId: ctx.principal.userId, type: "break_end", at: now, ip: ctx.ip ?? null } }),
    prisma.attendanceRecord.update({ where: { userId_date: { userId: ctx.principal.userId, date } }, data: { breakMinutes: (record?.breakMinutes ?? 0) + dur } }),
  ]);
  await audit(ctx, { action: "attendance.break_end", entityType: "AttendanceRecord", entityId: ctx.principal.userId, summary: `Break ended (${dur}m)` });
}

export async function checkOut(ctx: ActorContext): Promise<void> {
  const { date, record, state } = await loadToday(ctx.principal.userId);
  if (state === "out") throw new ServiceError("not_in", "You cannot check out before checking in.", 409);
  if (state === "on_break") throw new ServiceError("on_break", "End your break before checking out.", 409);
  if (state === "checked_out") throw new ServiceError("already_out", "You are already checked out.", 409);

  const now = new Date();
  const start = record!.actualStart!;
  const breakMinutes = record!.breakMinutes ?? 0;
  const totalWorkedMinutes = Math.max(0, mins(now, start) - breakMinutes);
  const expectedEnd = record!.expectedEnd ?? null;
  const earlyLeaveMinutes = expectedEnd ? mins(expectedEnd, now) : 0;
  const overtimeMinutes = expectedEnd ? mins(now, expectedEnd) : 0;

  await prisma.attendanceRecord.update({
    where: { userId_date: { userId: ctx.principal.userId, date } },
    data: { actualEnd: now, totalWorkedMinutes, earlyLeaveMinutes, overtimeMinutes },
  });
  await prisma.attendanceEvent.create({ data: { userId: ctx.principal.userId, type: "check_out", at: now, ip: ctx.ip ?? null } });
  await audit(ctx, { action: "attendance.check_out", entityType: "AttendanceRecord", entityId: ctx.principal.userId, summary: `Checked out (${totalWorkedMinutes}m worked)` });
}
