import type { Metadata } from "next";
import { Clock } from "lucide-react";
import { pageGuard } from "@/lib/page-guard";
import { AccessDenied } from "@/components/access-denied";
import { getAttendanceToday, getMyAttendanceToday } from "@/domain/attendance";
import { PageHeader, Panel, PanelHeader, PanelBody, DataTable, StatusBadge, Metric, EmptyState } from "@/components/ui";
import { UserChip } from "@/components/entity-chips";
import { ClockWidget } from "@/components/attendance/clock-widget";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Attendance" };

export default async function AttendancePage() {
  const { principal, locale, denied } = await pageGuard("attendance.view");
  if (denied) return <AccessDenied locale={locale} />;
  const [my, { rows, summary }] = await Promise.all([getMyAttendanceToday(principal), getAttendanceToday(principal)]);

  return (
    <>
      <PageHeader title="Attendance" description="Today's attendance — an accountability system, not surveillance (§22)." />
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
    </>
  );
}
