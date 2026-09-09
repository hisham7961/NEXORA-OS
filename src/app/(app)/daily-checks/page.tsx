import Link from "next/link";
import type { Metadata } from "next";
import { ClipboardCheck } from "lucide-react";
import { pageGuard } from "@/lib/page-guard";
import { AccessDenied } from "@/components/access-denied";
import { canAnywhere } from "@/lib/permissions/engine";
import { getDailyCompliance, type ComplianceRow } from "@/domain/daily-checks";
import { PageHeader, Panel, PanelHeader, DataTable, StatusBadge, Metric, Badge, EmptyState, type Column } from "@/components/ui";
import { RunGeneratorButton, VerifyButton } from "@/components/daily-checks/manager-actions";

export const metadata: Metadata = { title: "Daily Checks" };

export default async function DailyChecksPage() {
  const { principal, locale, denied } = await pageGuard("daily_checks.view");
  if (denied) return <AccessDenied locale={locale} />;
  void locale;
  const canManage = canAnywhere(principal, "daily_checks.manage");
  const { rows, templates, summary } = await getDailyCompliance(principal);

  const columns: Column<ComplianceRow>[] = [
    { key: "user", header: "Employee", render: (r) => r.userName },
    { key: "template", header: "Checklist", render: (r) => <Link href={`/daily-checks/${r.id}`} className="text-accent hover:underline">{r.templateName}</Link> },
    { key: "done", header: "Completed", align: "center", render: (r) => <span className="tabular">{r.done}/{r.total}</span> },
    { key: "status", header: "Status", render: (r) => <StatusBadge module="task" status={r.status === "complete" ? "completed" : r.status} /> },
    {
      key: "verify",
      header: "Verification",
      align: "end",
      render: (r) =>
        r.verified ? (
          <Badge category="success" dot>Verified</Badge>
        ) : (r.status === "complete" || r.status === "late") && canManage ? (
          <VerifyButton instanceId={r.id} />
        ) : (
          <span className="text-ink-3">—</span>
        ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Daily Checks"
        description="Recurring daily responsibilities and today's completion compliance (§8)."
        actions={canManage ? <RunGeneratorButton /> : undefined}
      />
      <Panel className="mb-4">
        <PanelHeader title="Today's compliance" />
        <div className="grid grid-cols-2 gap-4 p-4 sm:grid-cols-5">
          <Metric label="Total" value={summary.total} />
          <Metric label="Complete" value={summary.complete} category="success" />
          <Metric label="Pending" value={summary.pending} category="warning" />
          <Metric label="Late / Missed" value={summary.late + summary.missed} category={summary.late + summary.missed > 0 ? "critical" : "neutral"} />
          <Metric label="To verify" value={summary.pendingVerification} category={summary.pendingVerification > 0 ? "info" : "neutral"} />
        </div>
      </Panel>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel className="lg:col-span-2">
          <PanelHeader title="Employee compliance" />
          <DataTable
            columns={columns}
            rows={rows}
            getRowKey={(r) => r.id}
            empty={<EmptyState icon={<ClipboardCheck className="h-5 w-5" />} title="No checks scheduled today" description="Assign a recurring checklist template, then run the generator to create today's instances." />}
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
