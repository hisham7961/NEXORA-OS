import type { Metadata } from "next";
import Link from "next/link";
import { CalendarClock } from "lucide-react";
import { pageGuard } from "@/lib/page-guard";
import { AccessDenied } from "@/components/access-denied";
import { listTasks, taskQuerySchema } from "@/domain/tasks";
import { StatusBadge, PageHeader, Panel, EmptyState } from "@/components/ui";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Calendar" };
import { getServerI18n } from "@/lib/server-i18n";

export default async function CalendarPage() {
  const { principal, locale, denied } = await pageGuard("tasks.view");
  if (denied) return <AccessDenied locale={locale} />;
  const { t } = await getServerI18n();
  const query = taskQuerySchema.parse({ pageSize: "100" });
  const { rows } = await listTasks(principal, query);

  const now = new Date();
  const upcoming = rows.filter((t) => t.dueDate && t.dueDate >= new Date(now.getFullYear(), now.getMonth(), now.getDate()) && !["completed", "cancelled"].includes(t.status));

  // Group by due date (YYYY-MM-DD).
  const groups = new Map<string, typeof upcoming>();
  for (const t of upcoming) {
    const key = t.dueDate!.toISOString().slice(0, 10);
    const arr = groups.get(key) ?? [];
    arr.push(t);
    groups.set(key, arr);
  }
  const days = [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));

  return (
    <>
      <PageHeader title={t("calendar.title")} description={t("calendar.subtitle")} />
      <Panel>
        {days.length === 0 ? (
          <EmptyState icon={<CalendarClock className="h-5 w-5" />} title={t("cal.empty")} description={t("cal.emptyBody")} />
        ) : (
          <ul className="divide-y divide-line">
            {days.map(([day, tasks]) => (
              <li key={day} className="px-4 py-3">
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-3">{formatDate(new Date(day), locale)}</div>
                <ul className="space-y-1.5">
                  {tasks.map((t) => (
                    <li key={t.id}>
                      <Link href={`/tasks/${t.id}`} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] hover:bg-surface-2">
                        <span className="flex-1 text-ink">{t.title}</span>
                        <StatusBadge module="task" status={t.status} />
                      </Link>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}
