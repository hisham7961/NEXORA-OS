import Link from "next/link";
import { ListTodo, ClipboardCheck, Stamp, CalendarClock, Clock, AtSign, LifeBuoy, Palette, Megaphone, Share2, FileCheck, CreditCard, MessagesSquare } from "lucide-react";
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
  const { tasks, checks, approvals, deadlines, attendanceToday, mentions, cases, designs, campaigns, publishingToday, registrations, renewals, unreadDiscussions } = await getMyDay(principal);

  return (
    <>
      <PageHeader
        title={t("myday.title")}
        description={t("myday.subtitle")}
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
            <EmptyState title={t("myday.empty")} description={t("myday.tasksEmptyBody")} />
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
            <EmptyState title={t("myday.noChecks")} description={t("myday.noChecksBody")} />
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
            <EmptyState title={t("myday.nothingWaiting")} description={t("myday.nothingWaitingBody")} />
          ) : (
            <ul className="divide-y divide-line">
              {approvals.map((a) => (
                <li key={a.id}>
                  <Link href={`/approvals/${a.requestId}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-2">
                    <span className="flex-1 truncate text-[13px] text-ink">{a.title}</span>
                    <Badge category="warning" dot>{t("myday.pending")}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel>
          <PanelHeader title={t("myday.deadlines")} icon={<CalendarClock className="h-4 w-4" />} />
          {deadlines.length === 0 ? (
            <EmptyState title={t("myday.noDeadlines")} description={t("myday.noDeadlinesBody")} />
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

        {mentions.length > 0 && (
          <Panel>
            <PanelHeader title={t("myday.mentions")} icon={<AtSign className="h-4 w-4" />} action={<Link href="/notifications" className="text-xs text-accent hover:underline">{t("common.all")}</Link>} />
            <ul className="divide-y divide-line">
              {mentions.map((m) => (
                <li key={m.id}><Link href={m.channelId ? `/discussions/${m.channelId}` : "/notifications"} className="block px-4 py-2.5 hover:bg-surface-2"><div className="text-[13px] text-ink">{m.title}</div>{m.body && <div className="truncate text-xs text-ink-3">{m.body}</div>}</Link></li>
              ))}
            </ul>
          </Panel>
        )}

        {cases.length > 0 && (
          <Panel>
            <PanelHeader title={t("myday.myCases")} icon={<LifeBuoy className="h-4 w-4" />} action={<Link href="/cases" className="text-xs text-accent hover:underline">{t("common.all")}</Link>} />
            <ul className="divide-y divide-line">
              {cases.map((c) => (
                <li key={c.id}><Link href={`/cases/${c.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-2"><span className="flex-1 truncate text-[13px] capitalize text-ink">{c.type.replace(/_/g, " ")}</span><Badge className="capitalize">{t(`priority.${c.priority}`)}</Badge><StatusBadge module="customer_case" status={c.status} /></Link></li>
              ))}
            </ul>
          </Panel>
        )}

        {designs.length > 0 && (
          <Panel>
            <PanelHeader title={t("myday.myDesigns")} icon={<Palette className="h-4 w-4" />} action={<Link href="/design" className="text-xs text-accent hover:underline">{t("common.all")}</Link>} />
            <ul className="divide-y divide-line">
              {designs.map((d) => (
                <li key={d.id}><Link href={`/design/${d.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-2"><span className="flex-1 truncate text-[13px] capitalize text-ink">{d.assetType}</span><StatusBadge module="design" status={d.status} /></Link></li>
              ))}
            </ul>
          </Panel>
        )}

        {campaigns.length > 0 && (
          <Panel>
            <PanelHeader title={t("myday.myCampaigns")} icon={<Megaphone className="h-4 w-4" />} action={<Link href="/campaigns" className="text-xs text-accent hover:underline">{t("common.all")}</Link>} />
            <ul className="divide-y divide-line">
              {campaigns.map((c) => (
                <li key={c.id}><Link href={`/campaigns/${c.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-2"><span className="flex-1 truncate text-[13px] text-ink">{c.name}</span><StatusBadge module="campaign" status={c.status} /></Link></li>
              ))}
            </ul>
          </Panel>
        )}

        {publishingToday.length > 0 && (
          <Panel>
            <PanelHeader title={t("myday.publishingToday")} icon={<Share2 className="h-4 w-4" />} action={<Link href="/social" className="text-xs text-accent hover:underline">{t("common.all")}</Link>} />
            <ul className="divide-y divide-line">
              {publishingToday.map((p) => (
                <li key={p.id}><Link href={`/social/${p.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-2"><span className="flex-1 truncate text-[13px] capitalize text-ink">{p.contentType}{p.platform ? ` · ${p.platform}` : ""}</span><StatusBadge module="publishing" status={p.status} /></Link></li>
              ))}
            </ul>
          </Panel>
        )}

        {registrations.length > 0 && (
          <Panel>
            <PanelHeader title={t("myday.regActions")} icon={<FileCheck className="h-4 w-4" />} action={<Link href="/registrations" className="text-xs text-accent hover:underline">{t("common.all")}</Link>} />
            <ul className="divide-y divide-line">
              {registrations.map((r) => (
                <li key={r.id}><Link href={`/registrations/${r.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-2"><span className="flex-1 truncate text-[13px] text-ink">{r.label}</span>{r.dueDate && <span className="text-xs text-ink-3 tabular">{formatDateShort(r.dueDate, locale)}</span>}<StatusBadge module="generic" status={r.stage} /></Link></li>
              ))}
            </ul>
          </Panel>
        )}

        {renewals.length > 0 && (
          <Panel>
            <PanelHeader title={t("myday.renewals")} icon={<CreditCard className="h-4 w-4" />} action={<Link href="/subscriptions" className="text-xs text-accent hover:underline">{t("common.all")}</Link>} />
            <ul className="divide-y divide-line">
              {renewals.map((s) => (
                <li key={s.id}><Link href={`/subscriptions/${s.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-2"><span className="flex-1 truncate text-[13px] text-ink">{s.provider}</span><span className="text-xs text-warning tabular">{s.renewalDate ? formatDateShort(s.renewalDate, locale) : ""}</span></Link></li>
              ))}
            </ul>
          </Panel>
        )}

        {unreadDiscussions > 0 && (
          <Panel>
            <PanelHeader title={t("myday.discussions")} icon={<MessagesSquare className="h-4 w-4" />} />
            <Link href="/discussions" className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2">
              <span className="flex-1 text-[13px] text-ink">{t("myday.unreadPrefix")} <span className="font-semibold">{unreadDiscussions}</span> {unreadDiscussions === 1 ? t("myday.channelOne") : t("myday.channelMany")}</span>
              <Badge category="info">{unreadDiscussions}</Badge>
            </Link>
          </Panel>
        )}
      </div>
    </>
  );
}
