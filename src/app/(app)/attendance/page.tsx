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

export const metadata: Metadata = { title: "Attendance" };

export default async function AttendancePage() {
  const { principal, locale, denied } = await pageGuard("attendance.view");
  if (denied) return <AccessDenied locale={locale} />;
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
      <PageHeader title="Attendance" description="Today's attendance — an accountability system, not surveillance (§22)." actions={<RequestCorrectionButton />} />
      <Panel className="mb-4">
        <PanelHeader title="My clock" description="Check in, take breaks, and check out. Transitions are validated." />
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
          <Metric label="Present" value={summary.present} category="success" />
          <Metric label="Late" value={summary.late} category={summary.late > 0 ? "warning" : "neutral"} />
          <Metric label="Absent" value={summary.absent} category={summary.absent > 0 ? "critical" : "neutral"} />
          <Metric label="On leave" value={summary.leave} category="info" />
        </div>
      </Panel>
      <Panel>
        <PanelHeader title="Today" />
        <DataTable
          columns={[
            { key: "user", header: "Employee", render: (r) => <UserChip name={r.user.name} color={r.user.avatarColor} /> },
            { key: "expected", header: "Expected start", render: (r) => formatDateTime(r.expectedStart, locale) },
            { key: "actual", header: "Actual start", render: (r) => formatDateTime(r.actualStart, locale) },
            { key: "late", header: "Late (min)", align: "end", render: (r) => <span className={r.lateMinutes > 0 ? "text-warning tabular" : "text-ink-3 tabular"}>{r.lateMinutes}</span> },
            { key: "status", header: "Status", align: "end", render: (r) => <StatusBadge module="attendance" status={r.status} /> },
          ]}
          rows={rows}
          getRowKey={(r) => r.id}
          empty={<EmptyState icon={<Clock className="h-5 w-5" />} title="No attendance records today" description="Check-in / check-out events appear here with lateness and overtime." />}
        />
      </Panel>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {canManage && (
          <Panel>
            <PanelHeader title="Corrections to review" description="Approve, request changes, or reject." />
            <CorrectionList rows={pendingCorrections.map(toRow)} canDecide />
          </Panel>
        )}
        <Panel>
          <PanelHeader title="My correction requests" />
          <CorrectionList rows={myCorrections.map(toRow)} canDecide={false} />
        </Panel>
      </div>
    </>
  );
}
