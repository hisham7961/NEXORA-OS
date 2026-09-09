import { z } from "zod";
import { prisma } from "@/lib/db";
import { canAnywhere, type Principal } from "@/lib/permissions/engine";
import { ServiceError } from "@/lib/api/handler";
import { assertCan, audit, notify, type ActorContext } from "@/domain/mutation";
import { optionalString } from "@/lib/validation";

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

// ---------------------------------------------------------------------------
// ATTENDANCE CORRECTION LOOP (§25). Employees request corrections for their OWN
// attendance; managers (attendance.manage) approve/reject/request-changes.
// Approving applies the change; the original record and the request history are
// preserved.
// ---------------------------------------------------------------------------

const CORRECTION_TYPES = ["missed_check_in", "missed_check_out", "incorrect_time", "break_error", "other"] as const;
const CORRECTION_FIELDS = ["actualStart", "actualEnd", "breakMinutes"] as const;

export const correctionInputSchema = z.object({
  date: z.coerce.date({ invalid_type_error: "A date is required" }),
  type: z.enum(CORRECTION_TYPES),
  reason: z.string().trim().min(1).max(2000),
  field: z.enum(CORRECTION_FIELDS).optional(),
  requestedValue: optionalString, // ISO datetime for time fields, integer for breakMinutes
});

/** An employee requests a correction to their own attendance for a date. */
export async function requestAttendanceCorrection(ctx: ActorContext, raw: unknown) {
  const input = correctionInputSchema.parse(raw);
  const day = new Date(input.date.getFullYear(), input.date.getMonth(), input.date.getDate());
  const record = await prisma.attendanceRecord.findFirst({ where: { userId: ctx.principal.userId, date: day } });
  const oldValue = record && input.field ? String((record as Record<string, unknown>)[input.field] ?? "") : null;

  const correction = await prisma.attendanceCorrection.create({
    data: {
      userId: ctx.principal.userId, recordId: record?.id ?? null, date: day, type: input.type,
      reason: input.reason, field: input.field ?? null, oldValue, requestedValue: input.requestedValue ?? null,
      requestedById: ctx.principal.userId, status: "pending",
    },
  });
  await audit(ctx, { action: "attendance.correction_requested", entityType: "AttendanceCorrection", entityId: correction.id, summary: `${input.type} for ${day.toISOString().slice(0, 10)}` });
  // Notify managers who can decide (best-effort: users with attendance.manage).
  const managers = await managerUserIds();
  await notify(managers, { type: "attendance.correction_requested", title: "Attendance correction to review", body: input.reason.slice(0, 140), entityType: "AttendanceCorrection", entityId: correction.id }, ctx.principal.userId);
  return correction;
}

async function managerUserIds(): Promise<string[]> {
  // Users assigned a role granting attendance.manage (or super admins).
  const users = await prisma.user.findMany({
    where: { archivedAt: null, status: "active", OR: [{ isSuperAdmin: true }, { roleAssignments: { some: { role: { permissions: { some: { permissionKey: { in: ["attendance.manage", "*"] } } } } } } }] },
    select: { id: true }, take: 50,
  });
  return users.map((u) => u.id);
}

/** My correction requests (most recent first). */
export async function listMyCorrections(principal: Principal) {
  return prisma.attendanceCorrection.findMany({ where: { userId: principal.userId }, orderBy: { createdAt: "desc" }, take: 50 });
}

/** Pending corrections a manager can act on. */
export async function listPendingCorrections(principal: Principal) {
  if (!canAnywhere(principal, "attendance.manage")) return [];
  return prisma.attendanceCorrection.findMany({ where: { status: "pending" }, orderBy: { createdAt: "asc" }, take: 100 });
}

/**
 * Manager decision. On approve, the requested value is applied to the attendance
 * record (creating one for the date if none exists); the original record is not
 * destroyed — the correction row preserves before/after. reject / request_changes
 * leave the record unchanged.
 */
export async function decideAttendanceCorrection(ctx: ActorContext, id: string, decision: "approved" | "rejected" | "changes_requested", note?: string): Promise<void> {
  assertCan(ctx.principal, "attendance.manage");
  const c = await prisma.attendanceCorrection.findUnique({ where: { id } });
  if (!c) throw new ServiceError("not_found", "Correction not found", 404);
  if (c.status !== "pending") throw new ServiceError("decided", "This correction is already decided.", 422);

  await prisma.$transaction(async (tx) => {
    if (decision === "approved" && c.field && c.requestedValue != null) {
      const day = new Date(c.date);
      let record = await tx.attendanceRecord.findFirst({ where: { userId: c.userId, date: day } });
      if (!record) record = await tx.attendanceRecord.create({ data: { userId: c.userId, date: day, status: "present" } });
      const data: Record<string, unknown> = { adjustedById: ctx.principal.userId };
      if (c.field === "breakMinutes") data.breakMinutes = Math.max(0, parseInt(c.requestedValue, 10) || 0);
      else data[c.field] = new Date(c.requestedValue); // actualStart / actualEnd
      await tx.attendanceRecord.update({ where: { id: record.id }, data });
    }
    await tx.attendanceCorrection.update({ where: { id }, data: { status: decision, reviewerId: ctx.principal.userId, reviewNote: note ?? null, decidedAt: new Date() } });
  });
  await audit(ctx, { action: `attendance.correction_${decision}`, entityType: "AttendanceCorrection", entityId: id, summary: c.type });
  await notify([c.userId], { type: "attendance.correction_decided", title: `Your attendance correction was ${decision.replace("_", " ")}`, body: note ?? undefined, entityType: "AttendanceCorrection", entityId: id }, ctx.principal.userId);
}
