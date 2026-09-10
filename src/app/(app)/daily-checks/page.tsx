import Link from "next/link";
import type { Metadata } from "next";
import { ClipboardCheck } from "lucide-react";
import { pageGuard } from "@/lib/page-guard";
import { AccessDenied } from "@/components/access-denied";
import { canAnywhere } from "@/lib/permissions/engine";
import { getDailyCompliance, type ComplianceRow } from "@/domain/daily-checks";
import { PageHeader, Panel, PanelHeader, DataTable, StatusBadge, Metric, Badge, EmptyState, type Column } from "@/components/ui";
import { RunGeneratorButton, VerifyButton } from "@/components/daily-checks/manager-actions";
import { getServerI18n } from "@/lib/server-i18n";

export const metadata: Metadata = { title: "Daily Checks" };

export default async function DailyChecksPage() {
  const { principal, locale, denied } = await pageGuard("daily_checks.view");
  if (denied) return <AccessDenied locale={locale} />;
  void locale;
  const { t } = await getServerI18n();
  const canManage = canAnywhere(principal, "daily_checks.manage");
  const { rows, templates, summary } = await getDailyCompliance(principal);

  const columns: Column<ComplianceRow>[] = [
    { key: "user", header: t("checks.col.employee"), render: (r) => r.userName },
    { key: "template", header: t("checks.col.checklist"), render: (r) => <Link href={`/daily-checks/${r.id}`} className="text-accent hover:underline">{r.templateName}</Link> },
    { key: "done", header: t("checks.col.completed"), align: "center", render: (r) => <span className="tabular">{r.done}/{r.total}</span> },
    { key: "status", header: t("common.status"), render: (r) => <StatusBadge module="task" status={r.status === "complete" ? "completed" : r.status} /> },
    {
      key: "verify",
      header: t("checks.col.verification"),
      align: "end",
      render: (r) =>
        r.verified ? (
          <Badge category="success" dot>{t("checks.verified")}</Badge>
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
        title={t("checks.title")}
        description={t("checks.subtitleDaily")}
        actions={canManage ? <RunGeneratorButton /> : undefined}
      />
      <Panel className="mb-4">
        <PanelHeader title={t("checks.todayCompliance")} />
        <div className="grid grid-cols-2 gap-4 p-4 sm:grid-cols-5">
          <Metric label={t("checks.metric.total")} value={summary.total} />
          <Metric label={t("checks.metric.complete")} value={summary.complete} category="success" />
          <Metric label={t("checks.metric.pending")} value={summary.pending} category="warning" />
          <Metric label={t("checks.metric.late")} value={summary.late + summary.missed} category={summary.late + summary.missed > 0 ? "critical" : "neutral"} />
          <Metric label={t("checks.metric.toVerify")} value={summary.pendingVerification} category={summary.pendingVerification > 0 ? "info" : "neutral"} />
        </div>
      </Panel>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel className="lg:col-span-2">
          <PanelHeader title={t("checks.employeeCompliance")} />
          <DataTable
            columns={columns}
            rows={rows}
            getRowKey={(r) => r.id}
            empty={<EmptyState icon={<ClipboardCheck className="h-5 w-5" />} title={t("checks.emptyScheduled")} description={t("checks.emptyScheduledBody")} />}
          />
        </Panel>
        <Panel>
          <PanelHeader title={t("checks.activeTemplates")} />
          <ul className="divide-y divide-line">
            {templates.length === 0 ? (
              <li className="px-4 py-6 text-[13px] text-ink-3">{t("checks.noTemplates")}</li>
            ) : templates.map((tpl) => (
              <li key={tpl.id} className="px-4 py-2.5">
                <div className="text-[13px] font-medium text-ink">{tpl.name}</div>
                <div className="text-xs text-ink-3 capitalize">{tpl.scheduleType} · {t("checks.itemsAssigned", { items: tpl._count.items, assigned: tpl._count.assignments })}</div>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </>
  );
}
