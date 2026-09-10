import type { Metadata } from "next";
import { ShieldAlert, CheckCircle2 } from "lucide-react";
import { pageGuard } from "@/lib/page-guard";
import { AccessDenied } from "@/components/access-denied";
import { runDataQuality } from "@/domain/data-quality";
import { PageHeader, Panel, DataTable, Badge, EmptyState, type Column } from "@/components/ui";

export const metadata: Metadata = { title: "Data Quality" };

export default async function DataQualityPage() {
  const { principal, locale, denied } = await pageGuard("settings.view");
  if (denied) return <AccessDenied locale={locale} />;
  const { checks, total } = await runDataQuality(principal);
  type Check = (typeof checks)[number];
  const columns: Column<Check>[] = [
    { key: "label", header: "Check", render: (c) => <div><div className="text-ink">{c.label}</div><div className="text-[12px] text-ink-3">{c.description}</div></div> },
    { key: "count", header: "Records", align: "end", render: (c) => <span className={`tabular ${c.count > 0 ? (c.severity === "warning" ? "text-critical" : "text-warning") : "text-success"}`}>{c.count}</span> },
    { key: "status", header: "Status", align: "center", render: (c) => c.count === 0 ? <Badge category="success">clean</Badge> : <Badge category={c.severity === "warning" ? "critical" : "warning"}>{c.count} to fix</Badge> },
  ];

  return (
    <>
      <PageHeader title="Data Quality" description="Go-live-readiness checks for master data. Read-only — fix records through their normal screens."
        meta={total === 0 ? <Badge category="success">All clean</Badge> : <Badge category="warning">{total} records flagged</Badge>} />
      <Panel>
        <DataTable columns={columns} rows={checks} getRowKey={(c) => c.key}
          empty={<EmptyState icon={<CheckCircle2 className="h-5 w-5" />} title="Nothing to check" />} />
      </Panel>
      {total === 0 && <p className="mt-3 inline-flex items-center gap-1 text-[13px] text-success"><ShieldAlert className="h-4 w-4" /> Master data is ready for go-live.</p>}
    </>
  );
}
