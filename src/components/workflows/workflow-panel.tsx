import { Workflow as WorkflowIcon, Clock } from "lucide-react";
import type { Principal } from "@/lib/permissions/engine";
import { canAnywhere } from "@/lib/permissions/engine";
import { getInstanceForEntity, findActiveWorkflowForModule, availableTransitions, specOf, stageByKey } from "@/domain/workflows";
import { Panel, PanelHeader, Badge } from "@/components/ui";
import { TransitionControls, StartWorkflowControls, type TransitionOption } from "@/components/workflows/workflow-run-controls";
import { getServerI18n } from "@/lib/server-i18n";

interface Scope { companyId: string | null; brandId: string | null; countryId: string | null }

/**
 * Drop-in workflow panel for a record detail page (§26–27). Shows the record's
 * current stage, SLA deadline, available actions (permission-gated) and history —
 * or, if no instance exists yet, a button to start the governing workflow. Makes
 * the engine visible and operable from the record, never an invisible backend.
 */
export async function WorkflowPanel({ principal, entityType, entityId, module, scope, locale }: { principal: Principal; entityType: string; entityId: string; module: string; scope: Scope; locale?: string }) {
  if (!canAnywhere(principal, "workflows.view")) return null;
  void locale;
  const { t } = await getServerI18n();

  const instance = await getInstanceForEntity(principal, entityType, entityId).catch(() => null);

  if (!instance) {
    const def = await findActiveWorkflowForModule(module, scope);
    if (!def) return null;
    return (
      <Panel>
        <PanelHeader title={t("wf.workflow")} icon={<WorkflowIcon className="h-4 w-4" />} />
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div><div className="text-[13px] text-ink">{def.name}</div><div className="text-[12px] text-ink-3">{t("wf.notStarted")}</div></div>
          {canAnywhere(principal, "workflows.edit") && <StartWorkflowControls definitionId={def.id} entityType={entityType} entityId={entityId} scope={scope} label={def.name} />}
        </div>
      </Panel>
    );
  }

  const spec = specOf(instance.version);
  const stage = stageByKey(spec, instance.currentStage);
  const transitions = availableTransitions(principal, instance, spec, instance.definition.module);
  const trOptions: TransitionOption[] = transitions.map((tr) => ({ key: tr.key, name: tr.name, to: tr.to, requiredFields: stage?.requiredFields ?? [] }));
  const overdue = instance.status === "active" && instance.dueAt && instance.dueAt < new Date();

  return (
    <Panel>
      <PanelHeader
        title={t("wf.workflow")}
        icon={<WorkflowIcon className="h-4 w-4" />}
        action={<span className="text-[11px] text-ink-3">{instance.definition.name} · v{instance.version.version}</span>}
      />
      <div className="space-y-3 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[12px] text-ink-2">{t("wf.currentStage")}</span>
          <Badge category={stage?.category ?? "neutral"} dot>{stage?.name ?? instance.currentStage}</Badge>
          {instance.status !== "active" && <Badge category="neutral">{t(`status.${instance.status}`)}</Badge>}
          {instance.dueAt && instance.status === "active" && (
            <span className={`inline-flex items-center gap-1 text-[11.5px] ${overdue ? "text-critical" : "text-ink-3"} tabular`}><Clock className="h-3 w-3" /> {t("wf.due", { date: instance.dueAt.toISOString().slice(0, 10) })}{overdue ? t("wf.overdueSuffix") : ""}</span>
          )}
        </div>

        {instance.status === "active" && <TransitionControls instanceId={instance.id} transitions={trOptions} />}

        {/* History */}
        {instance.logs.length > 0 && (
          <ol className="space-y-1.5 border-t border-line pt-2">
            {instance.logs.slice(0, 6).map((l) => (
              <li key={l.id} className="flex items-center gap-2 text-[12px] text-ink-3">
                <span className="h-1 w-1 rounded-full bg-ink-3" />
                <span className="text-ink-2">{l.note ?? l.transitionKey}</span>
                <span className="ms-auto tabular">{l.at.toISOString().slice(0, 10)}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </Panel>
  );
}
