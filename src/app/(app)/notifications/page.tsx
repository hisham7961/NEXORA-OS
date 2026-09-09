import type { Metadata } from "next";
import { Bell } from "lucide-react";
import { requirePrincipal } from "@/lib/auth/current-user";
import { getServerI18n } from "@/lib/server-i18n";
import { listNotifications } from "@/domain/notifications";
import { PageHeader, Panel, EmptyState, Badge } from "@/components/ui";
import { formatRelative } from "@/lib/format";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const principal = await requirePrincipal();
  const { locale } = await getServerI18n();
  const { rows, unread } = await listNotifications(principal);

  return (
    <>
      <PageHeader title="Notifications" description="Mentions, assignments, approvals, deadlines and expirations." meta={unread > 0 ? <Badge category="info">{unread} unread</Badge> : undefined} />
      <Panel>
        {rows.length === 0 ? (
          <EmptyState icon={<Bell className="h-5 w-5" />} title="You're all caught up" description="New notifications will appear here, grouped to avoid spam." />
        ) : (
          <ul className="divide-y divide-line">
            {rows.map((n) => (
              <li key={n.id} className={`flex items-start gap-3 px-4 py-3 ${n.state === "unread" ? "bg-accent-soft/40" : ""}`}>
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.state === "unread" ? "bg-accent" : "bg-line-strong"}`} />
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-medium text-ink">{n.title}</div>
                  {n.body && <div className="text-xs text-ink-2">{n.body}</div>}
                </div>
                <span className="text-[11px] text-ink-3 whitespace-nowrap">{formatRelative(n.createdAt, locale)}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}
