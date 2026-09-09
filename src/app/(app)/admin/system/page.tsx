import type { Metadata } from "next";
import { Activity } from "lucide-react";
import { pageGuard } from "@/lib/page-guard";
import { AccessDenied } from "@/components/access-denied";
import { getSystemHealth } from "@/domain/platform";
import { PageHeader, Panel, PanelHeader, DataTable, StatusBadge, Metric, Badge, EmptyState } from "@/components/ui";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "System Health" };

export default async function SystemHealthPage() {
  const { locale, denied } = await pageGuard("developer.view");
  if (denied) return <AccessDenied locale={locale} />;
  const { jobs, events, summary } = await getSystemHealth();

  return (
    <>
      <PageHeader title="System Health" description="Background jobs, schedules and recent events — nothing runs invisibly (§37, §74, §75)." />
      <Panel className="mb-4">
        <div className="grid grid-cols-2 gap-4 p-4 sm:grid-cols-4">
          <Metric label="Succeeded" value={summary.success} category="success" />
          <Metric label="Running" value={summary.running} category="info" />
          <Metric label="Queued" value={summary.queued} />
          <Metric label="Failed" value={summary.failed} category={summary.failed > 0 ? "critical" : "neutral"} />
        </div>
      </Panel>

      <Panel className="mb-4">
        <PanelHeader title="Scheduled &amp; background jobs" icon={<Activity className="h-4 w-4" />} />
        <DataTable
          columns={[
            { key: "name", header: "Job", render: (j) => j.name },
            { key: "type", header: "Type", render: (j) => <span className="capitalize text-ink-3">{j.type}</span> },
            { key: "cron", header: "Schedule", render: (j) => <span className="font-mono text-xs text-ink-3">{j.scheduleCron ?? "—"}</span> },
            { key: "last", header: "Last run", render: (j) => formatDateTime(j.lastRunAt, locale) },
            { key: "next", header: "Next run", render: (j) => formatDateTime(j.nextRunAt, locale) },
            { key: "status", header: "Status", align: "end", render: (j) => <StatusBadge module="generic" status={j.status} /> },
          ]}
          rows={jobs}
          getRowKey={(j) => j.id}
          empty={<EmptyState title="No jobs registered" description="Recurring generators and reminders appear here with their status." />}
        />
      </Panel>

      <Panel>
        <PanelHeader title="Recent system events" />
        <ul className="divide-y divide-line">
          {events.length === 0 ? <li className="px-4 py-6 text-[13px] text-ink-3">No events.</li> : events.map((e) => (
            <li key={e.id} className="flex items-center gap-3 px-4 py-2.5">
              <Badge category={e.level === "error" ? "critical" : e.level === "warning" ? "warning" : "neutral"}>{e.level}</Badge>
              <span className="flex-1 text-[13px] text-ink">{e.message}</span>
              <span className="text-[11px] text-ink-3 tabular">{formatDateTime(e.createdAt, locale)}</span>
            </li>
          ))}
        </ul>
      </Panel>
    </>
  );
}
