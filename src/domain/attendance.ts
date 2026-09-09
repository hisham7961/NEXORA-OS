import { prisma } from "@/lib/db";
import type { Principal } from "@/lib/permissions/engine";

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
