import type { Metadata } from "next";
import type { WorkflowDefinition } from "@prisma/client";
import { Workflow } from "lucide-react";
import { pageGuard } from "@/lib/page-guard";
import { AccessDenied } from "@/components/access-denied";
import { canAnywhere } from "@/lib/permissions/engine";
import { listWorkflows, workflowQuerySchema } from "@/domain/workflows";
import { getScopedOptions } from "@/domain/options";
import { Badge, EmptyState, type Column } from "@/components/ui";
import { ResourceList } from "@/components/list/resource-list";
import { CreateWorkflowButton } from "@/components/workflows/workflow-controls";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Workflows" };
import { getServerI18n } from "@/lib/server-i18n";

const STATUS_CAT: Record<string, "neutral" | "info" | "success" | "warning" | "critical"> = { draft: "neutral", active: "success", archived: "neutral" };

export default async function WorkflowsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const { principal, locale, denied } = await pageGuard("workflows.view");
  if (denied) return <AccessDenied locale={locale} />;
  const { t } = await getServerI18n();
  const sp = await searchParams;
  const query = workflowQuerySchema.parse(sp);
  const canCreate = canAnywhere(principal, "workflows.create");
  const [{ rows, total }, options] = await Promise.all([
    listWorkflows(principal, query),
    canCreate ? getScopedOptions(principal, "workflows.create") : Promise.resolve(null),
  ]);

  const columns: Column<WorkflowDefinition>[] = [
    { key: "name", header: t("workflows.col.workflow"), render: (w) => <div><div className="text-[13px] font-medium text-ink">{w.name}</div><div className="font-mono text-[11px] text-ink-3">{w.key}</div></div> },
    { key: "module", header: t("workflows.col.governs"), render: (w) => <span className="capitalize text-ink-2">{w.module}</span> },
    { key: "status", header: t("common.status"), render: (w) => <Badge category={STATUS_CAT[w.status] ?? "neutral"}>{w.status}</Badge> },
    { key: "updated", header: t("common.updated"), align: "end", render: (w) => <span className="text-ink-3 tabular">{formatDate(w.updatedAt, locale)}</span> },
  ];

  return (
    <ResourceList title={t("workflows.title")} description={t("workflows.subtitle")}
      countLabel={t("workflows.count")} searchPlaceholder={t("workflows.searchPlaceholder")}
      filters={[{ name: "status", label: "Status", options: ["draft", "active", "archived"].map((v) => ({ value: v, label: v })) }]}
      actions={canCreate && options ? <CreateWorkflowButton options={{ brands: options.brands, countries: options.countries, companies: options.companies }} /> : undefined}
      columns={columns} rows={rows} getRowKey={(w) => w.id} getRowHref={(w) => `/workflows/${w.id}`}
      page={query.page} pageSize={query.pageSize} total={total} params={sp}
      empty={<EmptyState icon={<Workflow className="h-5 w-5" />} title={t("workflows.empty")} description="Model an approval or lifecycle process once, version it safely, and let records run through it." />} />
  );
}
