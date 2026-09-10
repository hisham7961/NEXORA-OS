import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Workflow, GitBranch, Activity } from "lucide-react";
import { pageGuard } from "@/lib/page-guard";
import { AccessDenied } from "@/components/access-denied";
import { canAnywhere, ForbiddenError } from "@/lib/permissions/engine";
import { allPermissionKeys } from "@/lib/permissions/catalog";
import { getWorkflow, listInstances, instanceQuerySchema } from "@/domain/workflows";
import { getActivity } from "@/domain/mutation";
import { getLookups, refName } from "@/domain/lookups";
import { parseSpec } from "@/lib/workflow/spec";
import { prisma } from "@/lib/db";
import { PageHeader, Panel, PanelHeader, PanelBody, Badge } from "@/components/ui";
import { ActivityTimeline, type TimelineEntry } from "@/components/activity-timeline";
import { WorkflowBuilder } from "@/components/workflows/workflow-builder";
import { OpenRevisionButton, ArchiveWorkflowButton } from "@/components/workflows/workflow-controls";
import { formatDate } from "@/lib/format";
import { getServerI18n } from "@/lib/server-i18n";

export const metadata: Metadata = { title: "Workflow" };

const V_CAT: Record<string, "neutral" | "info" | "success" | "warning" | "critical"> = { draft: "info", active: "success", retired: "neutral" };

export default async function WorkflowDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { principal, locale, denied } = await pageGuard("workflows.view");
  if (denied) return <AccessDenied locale={locale} />;
  const { t } = await getServerI18n();
  const { id } = await params;

  let def;
  try {
    def = await getWorkflow(principal, id);
  } catch (e) {
    if (e instanceof ForbiddenError) return <AccessDenied locale={locale} />;
    throw e;
  }
  if (!def) notFound();

  const versions = (def as typeof def & { versions: { id: string; version: number; status: string; definitionJson: string; changeNote: string | null; createdAt: Date; activatedAt: Date | null }[] }).versions;
  const draft = versions.find((v) => v.status === "draft");
  const active = versions.find((v) => v.status === "active");
  const shown = draft ?? active ?? versions[0];
  const editable = !!shown && shown.status === "draft" && canAnywhere(principal, "workflows.edit");

  let spec;
  try { spec = shown ? parseSpec(shown.definitionJson) : null; } catch { spec = null; }

  const [roles, { rows: instances, total: instanceTotal }, activity, lookups] = await Promise.all([
    prisma.role.findMany({ select: { key: true, name: true }, orderBy: { name: "asc" } }),
    listInstances(principal, instanceQuerySchema.parse({ page: "1", pageSize: "5", definitionId: id })),
    getActivity("WorkflowDefinition", id),
    getLookups(),
  ]);
  const permissions = allPermissionKeys();
  const activeInstances = instances.filter((i) => i.status === "active").length;
  const timeline: TimelineEntry[] = activity.map((a) => ({
    id: a.id, at: a.at, actorName: a.actorId ? refName(lookups.users, a.actorId) : t("common.system"),
    actorColor: a.actorId ? lookups.users.get(a.actorId)?.meta : null, action: a.action, summary: a.summary,
  }));

  return (
    <>
      <PageHeader
        title={def.name}
        description={def.description ?? t("wf.governsKey", { module: def.module, key: def.key })}
        meta={<div className="flex items-center gap-2"><Badge category={def.status === "active" ? "success" : "neutral"}>{t(`status.${def.status}`)}</Badge><span className="text-xs capitalize text-ink-3">{def.module}</span></div>}
        actions={
          <div className="flex items-center gap-2">
            {!draft && canAnywhere(principal, "workflows.edit") && <OpenRevisionButton workflowId={id} />}
            {canAnywhere(principal, "workflows.edit") && <ArchiveWorkflowButton workflowId={id} />}
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_300px]">
        <div>
          {spec ? (
            <WorkflowBuilder
              workflowId={id}
              versionId={shown.id}
              versionLabel={t("wf.versionLabel", { version: shown.version, status: t(`status.${shown.status}`) })}
              editable={editable}
              initialSpec={spec}
              permissions={permissions}
              roles={roles}
            />
          ) : (
            <Panel><div className="p-6 text-center text-[13px] text-critical">{t("wf.couldNotParse")}</div></Panel>
          )}
        </div>

        <div className="space-y-4">
          {/* Versions */}
          <Panel>
            <PanelHeader title={t("wf.versions")} icon={<GitBranch className="h-4 w-4" />} />
            <ul className="divide-y divide-line">
              {versions.map((v) => (
                <li key={v.id} className="flex items-center justify-between gap-2 px-4 py-2.5">
                  <div>
                    <div className="text-[13px] text-ink">v{v.version} {v.id === shown?.id && <span className="text-xs text-accent">{t("wf.shown")}</span>}</div>
                    <div className="text-[11px] text-ink-3">{v.changeNote ?? formatDate(v.createdAt, locale)}</div>
                  </div>
                  <Badge category={V_CAT[v.status] ?? "neutral"}>{t(`status.${v.status}`)}</Badge>
                </li>
              ))}
            </ul>
          </Panel>

          {/* Live instances */}
          <Panel>
            <PanelHeader title={t("wf.recordsInWorkflow")} icon={<Activity className="h-4 w-4" />} action={<span className="text-xs text-ink-3 tabular">{instanceTotal}</span>} />
            <div className="px-4 py-3">
              <div className="flex items-center gap-2 text-[13px] text-ink"><span className="text-2xl font-semibold tabular">{activeInstances}</span> {t("wf.activeCount")}</div>
              {instances.length === 0 ? (
                <p className="mt-2 text-[12px] text-ink-3">{t("wf.noRecordsRunning")}</p>
              ) : (
                <ul className="mt-2 space-y-1">
                  {instances.map((i) => (
                    <li key={i.id} className="flex items-center justify-between gap-2 text-[12px]">
                      <span className="truncate text-ink-2">{i.entityType} · {i.currentStage}</span>
                      <Badge category={i.status === "active" ? "info" : "neutral"}>{t(`status.${i.status}`)}</Badge>
                    </li>
                  ))}
                </ul>
              )}
              <Link href={`/workflows?tab=instances`} className="mt-3 inline-block text-xs text-accent hover:underline">{t("wf.operationalMonitor")}</Link>
            </div>
          </Panel>

          {/* Activity (audit-derived) */}
          <Panel>
            <PanelHeader title={t("wf.activity")} />
            <PanelBody><ActivityTimeline entries={timeline} locale={locale} empty={t("wf.noConfigChanges")} /></PanelBody>
          </Panel>
        </div>
      </div>
    </>
  );
}
