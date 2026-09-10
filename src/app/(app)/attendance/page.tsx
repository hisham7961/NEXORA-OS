import type { Metadata } from "next";
import { Clock } from "lucide-react";
import { pageGuard } from "@/lib/page-guard";
import { AccessDenied } from "@/components/access-denied";
import { canAnywhere } from "@/lib/permissions/engine";
import { getAttendanceToday, getMyAttendanceToday, listMyCorrections, listPendingCorrections } from "@/domain/attendance";
import { getLookups, refName } from "@/domain/lookups";
import { PageHeader, Panel, PanelHeader, PanelBody, DataTable, StatusBadge, Metric, EmptyState } from "@/components/ui";
import { UserChip } from "@/components/entity-chips";
import { ClockWidget } from "@/components/attendance/clock-widget";
import { RequestCorrectionButton, CorrectionList, type CorrectionRow } from "@/components/attendance/corrections";
import { formatDateTime } from "@/lib/format";
import { getServerI18n } from "@/lib/server-i18n";

export const metadata: Metadata = { title: "Attendance" };

export default async function AttendancePage() {
  const { principal, locale, denied } = await pageGuard("attendance.view");
  if (denied) return <AccessDenied locale={locale} />;
  const { t } = await getServerI18n();
  const canManage = canAnywhere(principal, "attendance.manage");
  const [my, { rows, summary }, myCorrections, pendingCorrections, lookups] = await Promise.all([
    getMyAttendanceToday(principal),
    getAttendanceToday(principal),
    listMyCorrections(principal),
    listPendingCorrections(principal),
    getLookups(),
  ]);
  const toRow = (c: Awaited<ReturnType<typeof listMyCorrections>>[number]): CorrectionRow => ({
    id: c.id, userName: refName(lookups.users, c.userId), date: c.date.toISOString(), type: c.type, reason: c.reason,
    status: c.status, requestedValue: c.requestedValue, oldValue: c.oldValue,
  });

  return (
    <>
      <PageHeader title={t("att.title")} description={t("att.subtitle")} actions={<RequestCorrectionButton />} />
      <Panel className="mb-4">
        <PanelHeader title={t("att.myClock")} description={t("att.myClockSub")} />
        <PanelBody>
          <ClockWidget
            state={my.state}
            startedAt={my.record?.actualStart ? formatDateTime(my.record.actualStart, locale) : null}
            workedMinutes={my.record?.totalWorkedMinutes}
          />
        </PanelBody>
      </Panel>
      <Panel className="mb-4">
        <div className="grid grid-cols-2 gap-4 p-4 sm:grid-cols-4">
          <Metric label={t("att.present")} value={summary.present} category="success" />
          <Metric label={t("att.late")} value={summary.late} category={summary.late > 0 ? "warning" : "neutral"} />
          <Metric label={t("att.absent")} value={summary.absent} category={summary.absent > 0 ? "critical" : "neutral"} />
          <Metric label={t("att.onLeave")} value={summary.leave} category="info" />
        </div>
      </Panel>
      <Panel>
        <PanelHeader title={t("att.today")} />
        <DataTable
          columns={[
            { key: "user", header: t("att.employee"), render: (r) => <UserChip name={r.user.name} color={r.user.avatarColor} /> },
            { key: "expected", header: t("att.expectedStart"), render: (r) => formatDateTime(r.expectedStart, locale) },
            { key: "actual", header: t("att.actualStart"), render: (r) => formatDateTime(r.actualStart, locale) },
            { key: "late", header: t("att.lateMin"), align: "end", render: (r) => <span className={r.lateMinutes > 0 ? "text-warning tabular" : "text-ink-3 tabular"}>{r.lateMinutes}</span> },
            { key: "status", header: t("common.status"), align: "end", render: (r) => <StatusBadge module="attendance" status={r.status} /> },
          ]}
          rows={rows}
          getRowKey={(r) => r.id}
          empty={<EmptyState icon={<Clock className="h-5 w-5" />} title={t("att.noRecords")} description={t("att.noRecordsBody")} />}
        />
      </Panel>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {canManage && (
          <Panel>
            <PanelHeader title={t("att.correctionsReview")} description={t("att.correctionsReviewSub")} />
            <CorrectionList rows={pendingCorrections.map(toRow)} canDecide />
          </Panel>
        )}
        <Panel>
          <PanelHeader title={t("att.myCorrections")} />
          <CorrectionList rows={myCorrections.map(toRow)} canDecide={false} />
        </Panel>
      </div>
    </>
  );
}
