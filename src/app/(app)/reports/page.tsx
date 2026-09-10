import type { Metadata } from "next";
import { pageGuard } from "@/lib/page-guard";
import { AccessDenied } from "@/components/access-denied";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { ReportBuilder } from "@/components/reports/report-builder";
import { getServerI18n } from "@/lib/server-i18n";

export const metadata: Metadata = { title: "Reports" };

export default async function ReportsPage() {
  const { principal, locale, denied } = await pageGuard("reports.view");
  if (denied) return <AccessDenied locale={locale} />;
  const { t } = await getServerI18n();
  // Saved operational reports are SavedViews under a "report:*" module namespace.
  const savedReports = await prisma.savedView.findMany({
    where: { userId: principal.userId, module: { startsWith: "report:" } },
    orderBy: { updatedAt: "desc" }, take: 100,
    select: { id: true, name: true, module: true, filtersJson: true },
  });

  return (
    <>
      <PageHeader title={t("rpt.title")} description={t("rpt.subtitle")} />
      <ReportBuilder savedReports={savedReports} />
    </>
  );
}
