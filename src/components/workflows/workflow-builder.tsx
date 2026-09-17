"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, Flag, CircleDot, Clock, ShieldCheck, Users, FileText, Stamp, ArrowRight, Save, CheckCircle2, AlertTriangle, Zap } from "lucide-react";
import { Button, Input, Textarea, Select, Badge, Drawer, Panel, PanelHeader } from "@/components/ui";
import { useToast, useI18n } from "@/components/providers";
import { saveWorkflowDraftAction, activateWorkflowVersionAction } from "@/app/actions/workflows";
import { validateSpec, STAGE_CATEGORIES, type WorkflowSpec, type WorkflowStageSpec, type WorkflowTransitionSpec, type StageCategory } from "@/lib/workflow/spec";

interface RoleOpt { key: string; name: string }

export function WorkflowBuilder({
  workflowId, versionId, versionLabel, editable, initialSpec, permissions, roles,
}: {
  workflowId: string; versionId: string; versionLabel: string; editable: boolean;
  initialSpec: WorkflowSpec; permissions: string[]; roles: RoleOpt[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const { t: tx } = useI18n();
  const [spec, setSpec] = useState<WorkflowSpec>(initialSpec);
  const [dirty, setDirty] = useState(false);
  const [pending, start] = useTransition();
  const [stageEdit, setStageEdit] = useState<{ index: number; stage: WorkflowStageSpec } | null>(null);
  const [transEdit, setTransEdit] = useState<{ index: number; tr: WorkflowTransitionSpec } | null>(null);

  const known = useMemo(() => ({ permissions: new Set(permissions), roles: new Set(roles.map((r) => r.key)) }), [permissions, roles]);
  const validation = useMemo(() => validateSpec(spec, known), [spec, known]);

  const mutate = (next: WorkflowSpec) => { setSpec(next); setDirty(true); };

  const save = () => start(async () => {
    const res = await saveWorkflowDraftAction(workflowId, spec);
    if (res.ok) { setDirty(false); toast({ kind: res.data?.ok ? "success" : "info", title: res.data?.ok ? tx("wf.draftSavedValid") : tx("wf.savedIssues", { count: res.data?.errors.length ?? 0 }) }); router.refresh(); }
    else toast({ kind: "error", title: res.error });
  });

  const activate = () => start(async () => {
    if (dirty) { const s = await saveWorkflowDraftAction(workflowId, spec); if (!s.ok) { toast({ kind: "error", title: s.error }); return; } setDirty(false); }
    const res = await activateWorkflowVersionAction(workflowId, versionId);
    if (res.ok) { toast({ kind: "success", title: tx("wf.versionActivated") }); router.refresh(); }
    else toast({ kind: "error", title: res.error });
  });

  const stageName = (key: string) => spec.stages.find((s) => s.key === key)?.name ?? key;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-medium text-ink">{versionLabel}</span>
          {editable ? <Badge category="info">{tx("wf.draftEditable")}</Badge> : <Badge category="neutral">{tx("wf.readOnly")}</Badge>}
          {dirty && <span className="text-xs text-warning">{tx("wf.unsavedChanges")}</span>}
        </div>
        {editable && (
          <div className="flex items-center gap-2">
            <Button size="sm" variant="secondary" disabled={pending || !dirty} onClick={save}><Save className="h-3.5 w-3.5" /> {tx("wf.saveDraft")}</Button>
            <Button size="sm" variant="primary" disabled={pending || !validation.ok} onClick={activate} title={validation.ok ? tx("wf.activateThis") : tx("wf.fixErrorsFirst")}><CheckCircle2 className="h-3.5 w-3.5" /> {tx("wf.validateActivate")}</Button>
          </div>
        )}
      </div>

      {/* Validation panel */}
      <ValidationPanel validation={validation} />

      {/* Stages */}
      <Panel>
        <PanelHeader title={tx("wf.stages")} icon={<CircleDot className="h-4 w-4" />} action={editable ? <Button size="sm" variant="ghost" onClick={() => setStageEdit({ index: -1, stage: { key: "", name: "", category: "neutral" } })}><Plus className="h-3.5 w-3.5" /> {tx("wf.addStage")}</Button> : undefined} />
        <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
          {spec.stages.map((s, i) => (
            <StageCard key={s.key || i} stage={s} editable={editable}
              onEdit={() => setStageEdit({ index: i, stage: s })}
              onDelete={() => mutate({ stages: spec.stages.filter((_, j) => j !== i), transitions: spec.transitions.filter((t) => t.from !== s.key && t.to !== s.key) })} />
          ))}
          {spec.stages.length === 0 && <div className="col-span-full py-6 text-center text-[13px] text-ink-3">{tx("wf.noStages")}</div>}
        </div>
      </Panel>

      {/* Transitions (flow) */}
      <Panel>
        <PanelHeader title={tx("wf.transitions")} icon={<ArrowRight className="h-4 w-4" />} action={editable ? <Button size="sm" variant="ghost" disabled={spec.stages.length < 1} onClick={() => setTransEdit({ index: -1, tr: { key: "", name: "", from: spec.stages[0]?.key ?? "", to: spec.stages[0]?.key ?? "" } })}><Plus className="h-3.5 w-3.5" /> {tx("wf.addTransition")}</Button> : undefined} />
        <ul className="divide-y divide-line">
          {spec.transitions.map((t, i) => (
            <li key={t.key || i} className="flex flex-wrap items-center gap-2 px-4 py-2.5">
              <Badge category="neutral">{t.from === "*" ? tx("wf.anyStage") : stageName(t.from)}</Badge>
              <ArrowRight className="h-3.5 w-3.5 text-ink-3" />
              <Badge category="info">{stageName(t.to)}</Badge>
              <span className="text-[13px] text-ink">{t.name}</span>
              {t.permission && <span className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] text-ink-2">{t.permission}</span>}
              {t.requiresApproval && <Badge category="warning"><Stamp className="h-3 w-3" /> {tx("wf.approval")}</Badge>}
              {editable && (
                <span className="ms-auto flex items-center gap-1">
                  <button className="rounded p-1 text-ink-3 hover:bg-surface-2 hover:text-ink" onClick={() => setTransEdit({ index: i, tr: t })}><Pencil className="h-3.5 w-3.5" /></button>
                  <button className="rounded p-1 text-ink-3 hover:bg-surface-2 hover:text-critical" onClick={() => mutate({ ...spec, transitions: spec.transitions.filter((_, j) => j !== i) })}><Trash2 className="h-3.5 w-3.5" /></button>
                </span>
              )}
            </li>
          ))}
          {spec.transitions.length === 0 && <li className="px-4 py-6 text-center text-[13px] text-ink-3">{tx("wf.noTransitions")}</li>}
        </ul>
      </Panel>

      {/* Stage editor */}
      {stageEdit && (
        <StageDrawer
          spec={spec} draft={stageEdit} roles={roles}
          onClose={() => setStageEdit(null)}
          onSave={(stage) => {
            const stages = [...spec.stages];
            if (stageEdit.index < 0) stages.push(stage); else stages[stageEdit.index] = stage;
            // If marked initial, clear other initials.
            if (stage.isInitial) stages.forEach((s, j) => { if (s.key !== stage.key && (stageEdit.index < 0 || j !== stageEdit.index) ) s.isInitial = false; });
            // Rename cascades to transitions.
            const oldKey = stageEdit.index >= 0 ? spec.stages[stageEdit.index].key : null;
            const transitions = oldKey && oldKey !== stage.key
              ? spec.transitions.map((t) => ({ ...t, from: t.from === oldKey ? stage.key : t.from, to: t.to === oldKey ? stage.key : t.to }))
              : spec.transitions;
            mutate({ stages, transitions }); setStageEdit(null);
          }}
        />
      )}

      {/* Transition editor */}
      {transEdit && (
        <TransitionDrawer
          spec={spec} draft={transEdit} permissions={permissions}
          onClose={() => setTransEdit(null)}
          onSave={(tr) => {
            const transitions = [...spec.transitions];
            if (transEdit.index < 0) transitions.push(tr); else transitions[transEdit.index] = tr;
            mutate({ ...spec, transitions }); setTransEdit(null);
          }}
        />
      )}
    </div>
  );
}

function ValidationPanel({ validation }: { validation: { ok: boolean; errors: string[]; warnings: string[] } }) {
  const { t: tx } = useI18n();
  if (validation.ok && validation.warnings.length === 0) {
    return <div className="flex items-center gap-2 rounded-md border border-success/30 bg-success-soft px-3 py-2 text-[13px] text-success"><CheckCircle2 className="h-4 w-4" /> {tx("wf.definitionValid")}</div>;
  }
  return (
    <div className="space-y-2">
      {validation.errors.map((e, i) => (
        <div key={`e${i}`} className="flex items-start gap-2 rounded-md border border-critical/30 bg-critical-soft px-3 py-2 text-[13px] text-critical"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {e}</div>
      ))}
      {validation.warnings.map((w, i) => (
        <div key={`w${i}`} className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning-soft px-3 py-2 text-[13px] text-warning"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {w}</div>
      ))}
    </div>
  );
}

function StageCard({ stage, editable, onEdit, onDelete }: { stage: WorkflowStageSpec; editable: boolean; onEdit: () => void; onDelete: () => void }) {
  const { t: tx } = useI18n();
  const border: Record<StageCategory, string> = { neutral: "border-s-ink-3", info: "border-s-info", success: "border-s-success", warning: "border-s-warning", critical: "border-s-critical" };
  return (
    <div className={`group relative rounded-lg border border-line border-s-4 ${border[stage.category]} bg-surface p-3`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-1.5 text-[13px] font-medium text-ink">{stage.name || <span className="text-ink-3">{tx("wf.untitled")}</span>}
            {stage.isInitial && <Flag className="h-3 w-3 text-accent" />}
          </div>
          <div className="font-mono text-[11px] text-ink-3">{stage.key || "—"}</div>
        </div>
        {editable && (
          <span className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            <button className="rounded p-1 text-ink-3 hover:bg-surface-2 hover:text-ink" onClick={onEdit}><Pencil className="h-3.5 w-3.5" /></button>
            <button className="rounded p-1 text-ink-3 hover:bg-surface-2 hover:text-critical" onClick={onDelete}><Trash2 className="h-3.5 w-3.5" /></button>
          </span>
        )}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {stage.isTerminal && <Badge category="success">{tx("wf.terminal")}</Badge>}
        {stage.slaHours ? <Badge category="neutral"><Clock className="h-3 w-3" /> {stage.slaHours}h</Badge> : null}
        {stage.responsibleRoles?.length ? <Badge category="neutral"><Users className="h-3 w-3" /> {stage.responsibleRoles.length}</Badge> : null}
        {stage.requiredFields?.length ? <Badge category="neutral"><FileText className="h-3 w-3" /> {tx("wf.fields", { count: stage.requiredFields.length })}</Badge> : null}
        {stage.requiredDocuments?.length ? <Badge category="neutral"><FileText className="h-3 w-3" /> {tx("wf.docs", { count: stage.requiredDocuments.length })}</Badge> : null}
        {stage.requiredApprovals ? <Badge category="warning"><ShieldCheck className="h-3 w-3" /> {stage.requiredApprovals}</Badge> : null}
        {stage.escalation ? <Badge category="critical"><Zap className="h-3 w-3" /> {stage.escalation.afterHours}h</Badge> : null}
      </div>
    </div>
  );
}

function csv(v: string | undefined): string[] | undefined { const a = (v ?? "").split(",").map((s) => s.trim()).filter(Boolean); return a.length ? a : undefined; }
function csvStr(a: string[] | undefined): string { return (a ?? []).join(", "); }

function StageDrawer({ spec, draft, roles, onClose, onSave }: { spec: WorkflowSpec; draft: { index: number; stage: WorkflowStageSpec }; roles: RoleOpt[]; onClose: () => void; onSave: (s: WorkflowStageSpec) => void }) {
  const { t: tx } = useI18n();
  const [s, setS] = useState<WorkflowStageSpec>({ ...draft.stage });
  const set = (patch: Partial<WorkflowStageSpec>) => setS((prev) => ({ ...prev, ...patch }));
  const isNew = draft.index < 0;
  const keyClash = spec.stages.some((st, j) => st.key === s.key && j !== draft.index);
  const valid = /^[a-z0-9][a-z0-9_]*$/.test(s.key) && s.name.trim().length > 0 && !keyClash;
  return (
    <Drawer open onClose={onClose} title={isNew ? tx("wf.addStage") : tx("wf.editStage")} description={tx("wf.stageDrawerSub")} width="560px">
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <label className="block"><span className="mb-1 block text-[12px] text-ink-2">{tx("wf.key")}</span><Input value={s.key} onChange={(e) => set({ key: e.target.value })} placeholder="in_review" /* i18n-ignore stage-key example */ />{keyClash && <span className="text-[11px] text-critical">{tx("wf.keyUsed")}</span>}</label>
          <label className="block"><span className="mb-1 block text-[12px] text-ink-2">{tx("common.name")}</span><Input value={s.name} onChange={(e) => set({ name: e.target.value })} placeholder={tx("wf.phInReview")} /></label>
        </div>
        <label className="block"><span className="mb-1 block text-[12px] text-ink-2">{tx("wf.categoryColor")}</span>
          <Select value={s.category} onChange={(e) => set({ category: e.target.value as StageCategory })}>{STAGE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}</Select>
        </label>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 text-[13px] text-ink-2"><input type="checkbox" className="accent-[var(--accent)]" checked={!!s.isInitial} onChange={(e) => set({ isInitial: e.target.checked })} /> {tx("wf.initialStart")}</label>
          <label className="flex items-center gap-2 text-[13px] text-ink-2"><input type="checkbox" className="accent-[var(--accent)]" checked={!!s.isTerminal} onChange={(e) => set({ isTerminal: e.target.checked })} /> {tx("wf.terminalEnd")}</label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="block"><span className="mb-1 block text-[12px] text-ink-2">{tx("wf.slaHours")}</span><Input type="number" min="0" value={s.slaHours ?? ""} onChange={(e) => set({ slaHours: e.target.value ? Number(e.target.value) : undefined })} placeholder="e.g. 48" /* i18n-ignore numeric example */ /></label>
          <label className="block"><span className="mb-1 block text-[12px] text-ink-2">{tx("wf.requiredApprovals")}</span><Input type="number" min="0" value={s.requiredApprovals ?? ""} onChange={(e) => set({ requiredApprovals: e.target.value ? Number(e.target.value) : undefined })} placeholder="0" /></label>
        </div>
        <label className="block"><span className="mb-1 block text-[12px] text-ink-2">{tx("wf.responsibleRoles")}</span>
          <Select value="" onChange={(e) => { const v = e.target.value; if (v && !(s.responsibleRoles ?? []).includes(v)) set({ responsibleRoles: [...(s.responsibleRoles ?? []), v] }); }}>
            <option value="">{tx("wf.addRole")}</option>{roles.map((r) => <option key={r.key} value={r.key}>{r.name}</option>)}
          </Select>
          <div className="mt-1.5 flex flex-wrap gap-1.5">{(s.responsibleRoles ?? []).map((r) => <button key={r} onClick={() => set({ responsibleRoles: (s.responsibleRoles ?? []).filter((x) => x !== r) })} className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-[11.5px] text-ink-2 hover:text-critical">{roles.find((x) => x.key === r)?.name ?? r} ✕</button>)}</div>
        </label>
        <label className="block"><span className="mb-1 block text-[12px] text-ink-2">{tx("wf.requiredFields")}</span><Input value={csvStr(s.requiredFields)} onChange={(e) => set({ requiredFields: csv(e.target.value) })} placeholder="justification, budget_code" /* i18n-ignore field-key example */ /></label>
        <label className="block"><span className="mb-1 block text-[12px] text-ink-2">{tx("wf.requiredDocs")}</span><Input value={csvStr(s.requiredDocuments)} onChange={(e) => set({ requiredDocuments: csv(e.target.value) })} placeholder="dossier, lab_report" /* i18n-ignore doc-key example */ /></label>
        <fieldset className="rounded-md border border-line p-3">
          <legend className="px-1 text-[12px] text-ink-2">{tx("wf.escalation")}</legend>
          <div className="grid grid-cols-2 gap-3">
            <label className="block"><span className="mb-1 block text-[12px] text-ink-2">{tx("wf.afterHours")}</span><Input type="number" min="0" value={s.escalation?.afterHours ?? ""} onChange={(e) => set({ escalation: e.target.value ? { afterHours: Number(e.target.value), toRoles: s.escalation?.toRoles, note: s.escalation?.note } : undefined })} /></label>
            <label className="block"><span className="mb-1 block text-[12px] text-ink-2">{tx("wf.escalateToRole")}</span>
              <Select value="" disabled={!s.escalation} onChange={(e) => { const v = e.target.value; if (v && s.escalation) set({ escalation: { ...s.escalation, toRoles: [...new Set([...(s.escalation.toRoles ?? []), v])] } }); }}>
                <option value="">{tx("wf.add")}</option>{roles.map((r) => <option key={r.key} value={r.key}>{r.name}</option>)}
              </Select>
            </label>
          </div>
          {s.escalation && (
            <>
              <div className="mt-1.5 flex flex-wrap gap-1.5">{(s.escalation.toRoles ?? []).map((r) => <button key={r} onClick={() => set({ escalation: { ...s.escalation!, toRoles: (s.escalation!.toRoles ?? []).filter((x) => x !== r) } })} className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-[11.5px] text-ink-2 hover:text-critical">{roles.find((x) => x.key === r)?.name ?? r} ✕</button>)}</div>
              <label className="mt-2 block"><span className="mb-1 block text-[12px] text-ink-2">{tx("wf.note")}</span><Input value={s.escalation.note ?? ""} onChange={(e) => set({ escalation: { ...s.escalation!, note: e.target.value || undefined } })} placeholder={tx("wf.phEscalationNote")} /></label>
            </>
          )}
        </fieldset>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" size="sm" onClick={onClose}>{tx("common.cancel")}</Button>
          <Button variant="primary" size="sm" disabled={!valid} onClick={() => onSave({ ...s, name: s.name.trim() })}>{isNew ? tx("common.add") : tx("common.save")}</Button>
        </div>
      </div>
    </Drawer>
  );
}

function TransitionDrawer({ spec, draft, permissions, onClose, onSave }: { spec: WorkflowSpec; draft: { index: number; tr: WorkflowTransitionSpec }; permissions: string[]; onClose: () => void; onSave: (t: WorkflowTransitionSpec) => void }) {
  const { t: tx } = useI18n();
  const [t, setT] = useState<WorkflowTransitionSpec>({ ...draft.tr });
  const set = (patch: Partial<WorkflowTransitionSpec>) => setT((prev) => ({ ...prev, ...patch }));
  const isNew = draft.index < 0;
  const keyClash = spec.transitions.some((x, j) => x.key === t.key && j !== draft.index);
  const valid = /^[a-z0-9][a-z0-9_]*$/.test(t.key) && t.name.trim().length > 0 && !!t.to && !keyClash;
  return (
    <Drawer open onClose={onClose} title={isNew ? tx("wf.addTransition") : tx("wf.editTransition")} description={tx("wf.transitionDrawerSub")} width="560px">
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <label className="block"><span className="mb-1 block text-[12px] text-ink-2">{tx("wf.key")}</span><Input value={t.key} onChange={(e) => set({ key: e.target.value })} placeholder="approve" /* i18n-ignore transition-key example */ />{keyClash && <span className="text-[11px] text-critical">{tx("wf.keyUsed")}</span>}</label>
          <label className="block"><span className="mb-1 block text-[12px] text-ink-2">{tx("wf.actionLabel")}</span><Input value={t.name} onChange={(e) => set({ name: e.target.value })} placeholder="Approve" /* i18n-ignore transition-label example */ /></label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="block"><span className="mb-1 block text-[12px] text-ink-2">{tx("wf.from")}</span>
            <Select value={t.from} onChange={(e) => set({ from: e.target.value })}><option value="*">{tx("wf.anyStage")}</option>{spec.stages.map((s) => <option key={s.key} value={s.key}>{s.name}</option>)}</Select>
          </label>
          <label className="block"><span className="mb-1 block text-[12px] text-ink-2">{tx("wf.to")}</span>
            <Select value={t.to} onChange={(e) => set({ to: e.target.value })}><option value="">{tx("wf.selectDots")}</option>{spec.stages.map((s) => <option key={s.key} value={s.key}>{s.name}</option>)}</Select>
          </label>
        </div>
        <label className="block"><span className="mb-1 block text-[12px] text-ink-2">{tx("wf.requiredPermission")}</span>
          <Select value={t.permission ?? ""} onChange={(e) => set({ permission: e.target.value || undefined })}>
            <option value="">{tx("wf.defaultModuleEdit")}</option>{permissions.map((p) => <option key={p} value={p}>{p}</option>)}
          </Select>
        </label>
        <label className="flex items-center gap-2 text-[13px] text-ink-2"><input type="checkbox" className="accent-[var(--accent)]" checked={!!t.requiresApproval} onChange={(e) => set({ requiresApproval: e.target.checked })} /> {tx("wf.requiresApprovalPerform")}</label>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" size="sm" onClick={onClose}>{tx("common.cancel")}</Button>
          <Button variant="primary" size="sm" disabled={!valid} onClick={() => onSave({ ...t, name: t.name.trim() })}>{isNew ? tx("common.add") : tx("common.save")}</Button>
        </div>
      </div>
    </Drawer>
  );
}
