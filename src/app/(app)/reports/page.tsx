import type { Metadata } from "next";
import { PieChart } from "lucide-react";
import { pageGuard } from "@/lib/page-guard";
import { AccessDenied } from "@/components/access-denied";
import { prisma } from "@/lib/db";
import { PageHeader, Panel, PanelHeader, EmptyState, Badge } from "@/components/ui";

export const metadata: Metadata = { title: "Reports" };

export default async function ReportsPage() {
  const { principal, locale, denied } = await pageGuard("reports.view");
  if (denied) return <AccessDenied locale={locale} />;
  const reports = await prisma.savedView.findMany({
    where: { OR: [{ userId: principal.userId }, { isShared: true }] },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });

  return (
    <>
      <PageHeader title="Reports" description="Reusable, saved report definitions across modules (§28)." />
      <Panel>
        {reports.length === 0 ? (
          <EmptyState
            icon={<PieChart className="h-5 w-5" />}
            title="No saved reports yet"
            description="The Report Builder lets management pick a data source, filters, columns and grouping, then save and export within permissions."
          />
        ) : (
          <ul className="divide-y divide-line">
            {reports.map((r) => (
              <li key={r.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <div className="text-[13px] font-medium text-ink">{r.name}</div>
                  <div className="text-xs text-ink-3 capitalize">{r.module}</div>
                </div>
                {r.isShared && <Badge category="info">Shared</Badge>}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}
