import type { Metadata } from "next";
import { pageGuard } from "@/lib/page-guard";
import { AccessDenied } from "@/components/access-denied";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { ReportBuilder } from "@/components/reports/report-builder";

export const metadata: Metadata = { title: "Reports" };

export default async function ReportsPage() {
  const { principal, locale, denied } = await pageGuard("reports.view");
  if (denied) return <AccessDenied locale={locale} />;
  // Saved operational reports are SavedViews under a "report:*" module namespace.
  const savedReports = await prisma.savedView.findMany({
    where: { userId: principal.userId, module: { startsWith: "report:" } },
    orderBy: { updatedAt: "desc" }, take: 100,
    select: { id: true, name: true, module: true, filtersJson: true },
  });

  return (
    <>
      <PageHeader title="Report Builder" description="Build operational reports from approved fields — filters, columns, grouping and aggregation. Every report enforces your permissions and scope; export carries the same. Distinct from the statutory Accounting reports." />
      <ReportBuilder savedReports={savedReports} />
    </>
  );
}
