import type { Metadata } from "next";
import { requirePrincipal } from "@/lib/auth/current-user";
import { listNotifications, getPreferences, NOTIFICATION_CATEGORIES } from "@/domain/notifications";
import { PageHeader, Badge } from "@/components/ui";
import { NotificationCenter, type NotifGroup } from "@/components/notifications/notification-center";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const principal = await requirePrincipal();
  const sp = await searchParams;
  const onlyUnread = sp.unread === "1";
  const category = sp.category || undefined;

  const [{ groups, unread }, preferences] = await Promise.all([
    listNotifications(principal, { onlyUnread, category }),
    getPreferences(principal),
  ]);

  const groupViews: NotifGroup[] = groups.map((g) => ({
    key: g.key, title: g.latest.title, body: g.latest.body, createdAt: g.latest.createdAt.toISOString(),
    count: g.count, ids: g.ids, href: g.href, category: g.category, unread: g.unread,
  }));

  return (
    <>
      <PageHeader
        title="Notifications"
        description="Mentions, assignments, approvals, deadlines and renewals — grouped, filterable, with per-category preferences (§22)."
        meta={unread > 0 ? <Badge category="info">{unread} unread</Badge> : undefined}
      />
      <NotificationCenter
        groups={groupViews}
        unread={unread}
        categories={[...NOTIFICATION_CATEGORIES]}
        preferences={preferences}
        activeCategory={category}
        onlyUnread={onlyUnread}
      />
    </>
  );
}
