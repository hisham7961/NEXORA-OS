import type { Metadata } from "next";
import { Activity, Clock } from "lucide-react";
import { pageGuard } from "@/lib/page-guard";
import { AccessDenied } from "@/components/access-denied";
import { canAnywhere } from "@/lib/permissions/engine";
import { getSystemHealth, getJobsOverview } from "@/domain/platform";
import { rateLimitBackend } from "@/lib/ratelimit";
import { PageHeader, Panel, PanelHeader, StatusBadge, Metric, Badge } from "@/components/ui";
import { RunJobButton } from "@/components/admin/job-controls";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Operations Center" };

export default async function SystemHealthPage() {
  const { principal, locale, denied } = await pageGuard("developer.view");
  if (denied) return <AccessDenied locale={locale} />;
  const [{ events, summary }, { jobs, recentRuns }] = await Promise.all([getSystemHealth(), getJobsOverview()]);
  const anyFailed = jobs.some((j) => j.last?.status === "failed");

  return (
    <>
      <PageHeader title="Operations Center" description="Live scheduler, background jobs, run history and recent events — nothing runs invisibly (§10, §37, §75)."
        meta={<Badge category={rateLimitBackend() === "memory" ? "warning" : "success"}>rate-limit: {rateLimitBackend()}</Badge>} />
      <Panel className="mb-4">
        <div className="grid grid-cols-2 gap-4 p-4 sm:grid-cols-4">
          <Metric label="Jobs scheduled" value={jobs.length} category="info" />
          <Metric label="Succeeded (rows)" value={summary.success} category="success" />
          <Metric label="Running" value={summary.running} />
          <Metric label="Failed" value={anyFailed ? jobs.filter((j) => j.last?.status === "failed").length : summary.failed} category={anyFailed || summary.failed > 0 ? "critical" : "neutral"} />
        </div>
      </Panel>

      <Panel className="mb-4">
        <PanelHeader title="Scheduled jobs" icon={<Clock className="h-4 w-4" />} action={<span className="text-[11px] text-ink-3">In-process scheduler · minute-aligned</span>} />
        <ul className="divide-y divide-line">
          {jobs.map((j) => {
            const failed = j.last?.status === "failed";
            const canRun = canAnywhere(principal, j.permission);
            return (
              <li key={j.name} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-[13px] font-medium text-ink">{j.name}
                    {j.last ? <StatusBadge module="generic" status={j.last.status} /> : <Badge category="neutral">never run</Badge>}
                  </div>
                  <div className="truncate text-[12px] text-ink-3">{j.description}</div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-3 text-[11px] text-ink-3">
                    <span className="font-mono">{j.cron}</span>
                    <span>next {formatDateTime(j.nextRunAt, locale)}</span>
                    {j.last && <span>last {formatDateTime(j.last.startedAt, locale)}{j.last.durationMs != null ? ` · ${j.last.durationMs}ms` : ""}{j.last.trigger === "manual" ? " · manual" : ""}</span>}
                    {failed && j.last?.error && <span className="text-critical">{j.last.error}</span>}
                  </div>
                </div>
                {canRun && <RunJobButton name={j.name} failed={failed} />}
              </li>
            );
          })}
        </ul>
      </Panel>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel>
          <PanelHeader title="Recent job runs" icon={<Activity className="h-4 w-4" />} />
          <ul className="divide-y divide-line">
            {recentRuns.length === 0 ? <li className="px-4 py-6 text-[13px] text-ink-3">No runs recorded yet — the scheduler records each fire here.</li> : recentRuns.map((r) => (
              <li key={r.id} className="flex items-center gap-3 px-4 py-2.5">
                <StatusBadge module="generic" status={r.status} />
                <span className="flex-1 truncate text-[13px] text-ink">{r.jobName}</span>
                <span className="text-[11px] text-ink-3">{r.trigger}</span>
                <span className="text-[11px] text-ink-3 tabular">{r.durationMs != null ? `${r.durationMs}ms` : ""}</span>
                <span className="text-[11px] text-ink-3 tabular">{formatDateTime(r.startedAt, locale)}</span>
              </li>
            ))}
          </ul>
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
      </div>
    </>
  );
}
