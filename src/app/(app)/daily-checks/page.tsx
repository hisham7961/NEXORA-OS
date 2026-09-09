import type { Metadata } from "next";
import { ClipboardCheck } from "lucide-react";
import { pageGuard } from "@/lib/page-guard";
import { AccessDenied } from "@/components/access-denied";
import { getDailyCompliance } from "@/domain/daily-checks";
import { PageHeader, Panel, PanelHeader, DataTable, StatusBadge, Metric, EmptyState } from "@/components/ui";

export const metadata: Metadata = { title: "Daily Checks" };

export default async function DailyChecksPage() {
  const { principal, locale, denied } = await pageGuard("daily_checks.view");
  if (denied) return <AccessDenied locale={locale} />;
  void locale;
  const { rows, templates, summary } = await getDailyCompliance(principal);

  return (
    <>
      <PageHeader title="Daily Checks" description="Recurring daily responsibilities and today's completion compliance (§8)." />
      <Panel className="mb-4">
        <PanelHeader title="Today's compliance" />
        <div className="grid grid-cols-2 gap-4 p-4 sm:grid-cols-4">
          <Metric label="Total" value={summary.total} />
          <Metric label="Complete" value={summary.complete} category="success" />
          <Metric label="Pending" value={summary.pending} category="warning" />
          <Metric label="Late / Missed" value={summary.late + summary.missed} category={summary.late + summary.missed > 0 ? "critical" : "neutral"} />
        </div>
      </Panel>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel className="lg:col-span-2">
          <PanelHeader title="Employee compliance" />
          <DataTable
            columns={[
              { key: "user", header: "Employee", render: (r) => r.userName },
              { key: "template", header: "Checklist", render: (r) => r.templateName },
              { key: "done", header: "Completed", align: "center", render: (r) => <span className="tabular">{r.done}/{r.total}</span> },
              { key: "status", header: "Status", align: "end", render: (r) => <StatusBadge module="task" status={r.status === "complete" ? "completed" : r.status} /> },
            ]}
            rows={rows}
            getRowKey={(r) => r.id}
            empty={<EmptyState icon={<ClipboardCheck className="h-5 w-5" />} title="No checks scheduled today" description="Assign a recurring checklist template to employees to track daily compliance." />}
          />
        </Panel>
        <Panel>
          <PanelHeader title="Active templates" />
          <ul className="divide-y divide-line">
            {templates.length === 0 ? (
              <li className="px-4 py-6 text-[13px] text-ink-3">No templates yet.</li>
            ) : templates.map((t) => (
              <li key={t.id} className="px-4 py-2.5">
                <div className="text-[13px] font-medium text-ink">{t.name}</div>
                <div className="text-xs text-ink-3 capitalize">{t.scheduleType} · {t._count.items} items · {t._count.assignments} assigned</div>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </>
  );
}
