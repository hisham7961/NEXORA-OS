import Link from "next/link";
import { ListTodo, ClipboardCheck, Stamp, CalendarClock, Clock } from "lucide-react";
import type { Metadata } from "next";
import { requirePrincipal } from "@/lib/auth/current-user";
import { getServerI18n } from "@/lib/server-i18n";
import { getMyDay } from "@/domain/my-day";
import { Panel, PanelHeader, PanelBody, PageHeader, EmptyState, StatusBadge, Badge } from "@/components/ui";
import { PRIORITY_CATEGORY } from "@/lib/status";
import { formatDateShort } from "@/lib/format";

export const metadata: Metadata = { title: "My Day" };

export default async function MyDayPage() {
  const principal = await requirePrincipal();
  const { t, locale } = await getServerI18n();
  const { tasks, checks, approvals, deadlines, attendanceToday } = await getMyDay(principal);

  return (
    <>
      <PageHeader
        title={t("myday.title")}
        description="Your responsibilities for today, in one place."
        actions={
          <div className="flex items-center gap-2">
            {attendanceToday?.checkedIn ? (
              <Badge category="success" dot>{t("myday.attendance")}: {t("common.today")}</Badge>
            ) : (
              <Link href="/attendance" className="inline-flex h-9 items-center gap-1.5 rounded-md bg-accent px-3 text-[13px] font-medium text-on-accent hover:bg-accent-hover">
                <Clock className="h-4 w-4" /> {t("myday.checkIn")}
              </Link>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel>
          <PanelHeader title={t("myday.tasks")} icon={<ListTodo className="h-4 w-4" />} action={<span className="text-xs text-ink-3 tabular">{tasks.length}</span>} />
          {tasks.length === 0 ? (
            <EmptyState title={t("myday.empty")} description="Tasks assigned to you or that you own will appear here." />
          ) : (
            <ul className="divide-y divide-line">
              {tasks.map((task) => {
                const overdue = task.dueDate && task.dueDate < new Date();
                return (
                  <li key={task.id}>
                    <Link href={`/tasks/${task.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-2">
                      <span className={`h-1.5 w-1.5 rounded-full ${PRIORITY_CATEGORY[task.priority] === "critical" ? "bg-critical" : PRIORITY_CATEGORY[task.priority] === "warning" ? "bg-warning" : "bg-ink-3"}`} />
                      <span className="flex-1 truncate text-[13px] text-ink">{task.title}</span>
                      {task.dueDate && (
                        <span className={`text-xs tabular ${overdue ? "text-critical" : "text-ink-3"}`}>{formatDateShort(task.dueDate, locale)}</span>
                      )}
                      <StatusBadge module="task" status={task.status} />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <Panel>
          <PanelHeader title={t("myday.checks")} icon={<ClipboardCheck className="h-4 w-4" />} action={<Link href="/daily-checks" className="text-xs text-accent hover:underline">{t("common.viewAll")}</Link>} />
          {checks.length === 0 ? (
            <EmptyState title="No checks for today" description="Recurring daily checks assigned to you will appear here (§8)." />
          ) : (
            <ul className="divide-y divide-line">
              {checks.map((c) => (
                <li key={c.id} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="flex-1 truncate text-[13px] text-ink">{c.templateName}</span>
                  <span className="text-xs text-ink-3 tabular">{c.done}/{c.total}</span>
                  <StatusBadge module="task" status={c.status === "complete" ? "completed" : c.status} />
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel>
          <PanelHeader title={t("myday.approvals")} icon={<Stamp className="h-4 w-4" />} action={<Link href="/approvals" className="text-xs text-accent hover:underline">{t("common.viewAll")}</Link>} />
          {approvals.length === 0 ? (
            <EmptyState title="Nothing waiting for you" description="Items needing your approval will appear here (§24)." />
          ) : (
            <ul className="divide-y divide-line">
              {approvals.map((a) => (
                <li key={a.id}>
                  <Link href={`/approvals/${a.requestId}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-2">
                    <span className="flex-1 truncate text-[13px] text-ink">{a.title}</span>
                    <Badge category="warning" dot>Pending</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel>
          <PanelHeader title={t("myday.deadlines")} icon={<CalendarClock className="h-4 w-4" />} />
          {deadlines.length === 0 ? (
            <EmptyState title="No upcoming deadlines" description="Work due within the next 7 days will appear here." />
          ) : (
            <ul className="divide-y divide-line">
              {deadlines.map((d) => (
                <li key={d.id} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="flex-1 truncate text-[13px] text-ink">{d.title}</span>
                  <span className="text-xs text-ink-3 tabular">{formatDateShort(d.dueDate, locale)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
