import { describe, it, expect, beforeAll, afterEach, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { invalidateSettingsCache } from "@/domain/settings";
import { checkIn } from "@/domain/attendance";
import type { ActorContext } from "@/lib/action";
import type { Principal } from "@/lib/permissions/engine";

/**
 * Regression for audit DOM-04: attendance.lateThresholdMinutes must actually gate
 * whether a check-in counts as late. A user 5 minutes past their expected start is
 * "present" under a 10-minute grace but "late" under a 2-minute grace.
 *
 * DB-gated: skips when no Postgres is reachable; runs in CI.
 */
const P = "attwire_";
const uid = P + "user";
const principal: Principal = { userId: uid, isSuperAdmin: false, assignments: [] };
const ctx: ActorContext = { principal, ip: null, userAgent: null };
let dbUp = false;

function startOfToday() { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); }

beforeAll(async () => {
  try { await prisma.$queryRaw`select 1`; dbUp = true; } catch { dbUp = false; return; }
  await prisma.attendanceRecord.deleteMany({ where: { userId: uid } }).catch(() => {});
  await prisma.attendanceEvent.deleteMany({ where: { userId: uid } }).catch(() => {});
  await prisma.user.deleteMany({ where: { id: uid } }).catch(() => {});
  await prisma.user.create({ data: { id: uid, email: uid + "@t.local", name: "Att User", passwordHash: "x" } });
});

afterEach(async () => {
  if (!dbUp) return;
  await prisma.attendanceEvent.deleteMany({ where: { userId: uid } }).catch(() => {});
  await prisma.attendanceRecord.deleteMany({ where: { userId: uid } }).catch(() => {});
});

afterAll(async () => {
  if (!dbUp) return;
  await prisma.systemSetting.deleteMany({ where: { key: "attendance.lateThresholdMinutes" } }).catch(() => {});
  invalidateSettingsCache();
  await prisma.user.deleteMany({ where: { id: uid } }).catch(() => {});
});

async function setThreshold(minutes: number) {
  await prisma.systemSetting.upsert({
    where: { key: "attendance.lateThresholdMinutes" },
    update: { valueJson: String(minutes) },
    create: { key: "attendance.lateThresholdMinutes", valueJson: String(minutes) },
  });
  invalidateSettingsCache();
}

async function seedExpectedStart(minutesAgo: number) {
  await prisma.attendanceRecord.create({
    data: { userId: uid, date: startOfToday(), expectedStart: new Date(Date.now() - minutesAgo * 60_000), actualStart: null },
  });
}

describe("DOM-04 — lateThresholdMinutes gates the 'late' status", () => {
  it("within the grace period → present", async () => {
    if (!dbUp) return;
    await setThreshold(10);
    await seedExpectedStart(5); // 5 min past, grace 10
    await checkIn(ctx);
    const rec = await prisma.attendanceRecord.findUnique({ where: { userId_date: { userId: uid, date: startOfToday() } } });
    expect(rec?.status).toBe("present");
    expect(rec?.lateMinutes).toBe(0);
  });

  it("beyond the grace period → late", async () => {
    if (!dbUp) return;
    await setThreshold(2);
    await seedExpectedStart(5); // 5 min past, grace 2
    await checkIn(ctx);
    const rec = await prisma.attendanceRecord.findUnique({ where: { userId_date: { userId: uid, date: startOfToday() } } });
    expect(rec?.status).toBe("late");
    expect(rec?.lateMinutes).toBeGreaterThanOrEqual(4);
  });
});
