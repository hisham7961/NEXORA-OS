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

const STATUS_CAT: Record<string, "neutral" | "info" | "success" | "warning" | "critical"> = { draft: "neutral", active: "success", archived: "neutral" };

export default async function WorkflowsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const { principal, locale, denied } = await pageGuard("workflows.view");
  if (denied) return <AccessDenied locale={locale} />;
  const sp = await searchParams;
  const query = workflowQuerySchema.parse(sp);
  const canCreate = canAnywhere(principal, "workflows.create");
  const [{ rows, total }, options] = await Promise.all([
    listWorkflows(principal, query),
    canCreate ? getScopedOptions(principal, "workflows.create") : Promise.resolve(null),
  ]);

  const columns: Column<WorkflowDefinition>[] = [
    { key: "name", header: "Workflow", render: (w) => <div><div className="text-[13px] font-medium text-ink">{w.name}</div><div className="font-mono text-[11px] text-ink-3">{w.key}</div></div> },
    { key: "module", header: "Governs", render: (w) => <span className="capitalize text-ink-2">{w.module}</span> },
    { key: "status", header: "Status", render: (w) => <Badge category={STATUS_CAT[w.status] ?? "neutral"}>{w.status}</Badge> },
    { key: "updated", header: "Updated", align: "end", render: (w) => <span className="text-ink-3 tabular">{formatDate(w.updatedAt, locale)}</span> },
  ];

  return (
    <ResourceList title="Workflows" description="Versioned, declarative processes — stages, transitions, SLAs, approvals and permissions. Records stay bound to the version they started under (§26–27)."
      countLabel="workflows" searchPlaceholder="Search workflows…"
      filters={[{ name: "status", label: "Status", options: ["draft", "active", "archived"].map((v) => ({ value: v, label: v })) }]}
      actions={canCreate && options ? <CreateWorkflowButton options={{ brands: options.brands, countries: options.countries, companies: options.companies }} /> : undefined}
      columns={columns} rows={rows} getRowKey={(w) => w.id} getRowHref={(w) => `/workflows/${w.id}`}
      page={query.page} pageSize={query.pageSize} total={total} params={sp}
      empty={<EmptyState icon={<Workflow className="h-5 w-5" />} title="No workflows yet" description="Model an approval or lifecycle process once, version it safely, and let records run through it." />} />
  );
}
