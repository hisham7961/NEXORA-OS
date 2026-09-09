import type { Metadata } from "next";
import { pageGuard } from "@/lib/page-guard";
import { AccessDenied } from "@/components/access-denied";
import { getAnalyticsOverview } from "@/domain/analytics";
import { PageHeader, Panel, PanelHeader, PanelBody, Metric } from "@/components/ui";
import { formatCurrency, formatNumber } from "@/lib/format";

export const metadata: Metadata = { title: "Analytics" };

export default async function AnalyticsPage() {
  const { principal, locale, denied } = await pageGuard("analytics.view");
  if (denied) return <AccessDenied locale={locale} />;
  const a = await getAnalyticsOverview(principal);

  return (
    <>
      <PageHeader title="Analytics" description="Cross-module intelligence — every tile answers a business question (§27)." />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Panel>
          <PanelHeader title="Marketing" />
          <PanelBody className="grid grid-cols-2 gap-4">
            <Metric label="Live campaigns" value={a.marketing.liveCampaigns} category="success" />
            <Metric label="ROAS" value={`${a.marketing.roas.toFixed(2)}×`} />
            <Metric label="Revenue (attributed)" value={formatCurrency(a.marketing.revenue, "KWD", locale)} />
            <Metric label="Spend" value={formatCurrency(a.marketing.spend, "KWD", locale)} />
          </PanelBody>
        </Panel>
        <Panel>
          <PanelHeader title="Operations" />
          <PanelBody className="grid grid-cols-2 gap-4">
            <Metric label="Task completion" value={`${a.operations.completion}%`} sub={`${a.operations.tasksDone}/${a.operations.tasksTotal} tasks`} />
            <Metric label="Active registrations" value={formatNumber(a.regulatory.activeRegs, locale)} />
            <Metric label="Open customer cases" value={formatNumber(a.service.openCases, locale)} category={a.service.openCases > 0 ? "warning" : "neutral"} />
          </PanelBody>
        </Panel>
      </div>
    </>
  );
}
