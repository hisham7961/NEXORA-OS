import { prisma } from "@/lib/db";
import type { Principal } from "@/lib/permissions/engine";

/** Notification center (§30) — the current user's own notifications. */
export async function listNotifications(principal: Principal) {
  const rows = await prisma.notification.findMany({
    where: { userId: principal.userId, state: { not: "archived" } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return {
    rows,
    unread: rows.filter((n) => n.state === "unread").length,
  };
}
