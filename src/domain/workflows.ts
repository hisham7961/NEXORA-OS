import { z } from "zod";
import type { WorkflowDefinition, WorkflowVersion, WorkflowInstance } from "@prisma/client";
import { prisma } from "@/lib/db";
import { assertRecordInScope, scopeWhereFor, canAnywhere, ForbiddenError, type Principal } from "@/lib/permissions/engine";
import { allPermissionKeys } from "@/lib/permissions/catalog";
import { listQuerySchema } from "@/lib/api/pagination";
import { ServiceError } from "@/lib/api/handler";
import { assertCan, audit, notify, DIMS_CBC, type ActorContext } from "@/domain/mutation";
import { optionalString } from "@/lib/validation";
import {
  parseSpec, validateSpec, parseAndValidate, initialStage, stageByKey, transitionsFrom,
  type WorkflowSpec, type ValidationResult, type WorkflowTransitionSpec, type WorkflowStageSpec,
} from "@/lib/workflow/spec";

/**
 * CONFIGURABLE WORKFLOW ENGINE (§26–27, §50).
 *
 * Definition lifecycle: a WorkflowDefinition holds one or more immutable
 * WorkflowVersions. Editing only ever touches a *draft* version; activating a
 * version validates it first and retires the previous active one. Live records
 * run as WorkflowInstances BOUND to the exact version they started under, so a
 * later edit or activation never changes the meaning of records already moving.
 *
 * Authorization: definition authoring is gated by the `workflows` module.
 * Instance reads are scoped to the governed record (DIMS_CBC). A transition is
 * gated by the transition's declared permission (or the governed module's edit)
 * evaluated in the instance's scope — so the permission model in the builder is
 * really enforced server-side, not just drawn.
 */

// ---------------------------------------------------------------------------
// References the validator cross-checks against (permission catalog + live roles)
// ---------------------------------------------------------------------------
async function knownRefs(): Promise<{ permissions: Set<string>; roles: Set<string> }> {
  const roles = await prisma.role.findMany({ select: { key: true } });
  return { permissions: new Set(allPermissionKeys()), roles: new Set(roles.map((r) => r.key)) };
}

// ---------------------------------------------------------------------------
// DEFINITION QUERIES
// ---------------------------------------------------------------------------
export const workflowQuerySchema = listQuerySchema.extend({
  module: z.string().optional(),
  status: z.string().optional(),
});
export type WorkflowQuery = z.infer<typeof workflowQuerySchema>;

export async function listWorkflows(principal: Principal, query: WorkflowQuery): Promise<{ rows: WorkflowDefinition[]; total: number }> {
  const scope = scopeWhereFor(principal, "workflows.view", DIMS_CBC);
  const where: Record<string, unknown> = {
    archivedAt: null,
    ...scope,
    ...(query.module ? { module: query.module } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.q ? { name: { contains: query.q, mode: "insensitive" } } : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.workflowDefinition.findMany({ where, orderBy: { updatedAt: "desc" }, skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
    prisma.workflowDefinition.count({ where }),
  ]);
  return { rows, total };
}

export async function getWorkflow(principal: Principal, id: string) {
  const def = await prisma.workflowDefinition.findUnique({
    where: { id },
    include: { versions: { orderBy: { version: "desc" } } },
  });
  if (!def || def.archivedAt) return null;
  if (!canAnywhere(principal, "workflows.view")) throw new ForbiddenError("workflows.view");
  assertRecordInScope(principal, "workflows.view", def, DIMS_CBC);
  return def;
}

/** Parse a version's stored spec (throws a ServiceError if corrupt). */
export function specOf(version: Pick<WorkflowVersion, "definitionJson">): WorkflowSpec {
  try {
    return parseSpec(version.definitionJson);
  } catch {
    throw new ServiceError("corrupt_spec", "This workflow version's definition is corrupt.", 500);
  }
}

/** The active spec for a definition, or null if it has no active version. */
export async function activeSpec(definitionId: string): Promise<{ version: WorkflowVersion; spec: WorkflowSpec } | null> {
  const version = await prisma.workflowVersion.findFirst({ where: { definitionId, status: "active" }, orderBy: { version: "desc" } });
  if (!version) return null;
  return { version, spec: specOf(version) };
}

// ---------------------------------------------------------------------------
// DEFINITION AUTHORING
// ---------------------------------------------------------------------------
const STARTER_SPEC: WorkflowSpec = {
  stages: [
    { key: "draft", name: "Draft", category: "neutral", isInitial: true },
    { key: "in_review", name: "In Review", category: "info" },
    { key: "approved", name: "Approved", category: "success", isTerminal: true },
    { key: "rejected", name: "Rejected", category: "critical", isTerminal: true },
  ],
  transitions: [
    { key: "submit", name: "Submit for review", from: "draft", to: "in_review" },
    { key: "approve", name: "Approve", from: "in_review", to: "approved" },
    { key: "reject", name: "Reject", from: "in_review", to: "rejected" },
    { key: "revise", name: "Send back to draft", from: "in_review", to: "draft" },
  ],
};

export const createWorkflowSchema = z.object({
  key: z.string().regex(/^[a-z0-9][a-z0-9_]*$/, "key must be lower_snake_case").max(60),
  name: z.string().trim().min(1).max(120),
  module: z.string().trim().min(1).max(40),
  description: optionalString,
  companyId: optionalString,
  brandId: optionalString,
  countryId: optionalString,
});

export async function createWorkflow(ctx: ActorContext, raw: unknown): Promise<WorkflowDefinition> {
  const input = createWorkflowSchema.parse(raw);
  assertCan(ctx.principal, "workflows.create", { companyId: input.companyId ?? null, brandId: input.brandId ?? null, countryId: input.countryId ?? null });
  const existing = await prisma.workflowDefinition.findUnique({ where: { key: input.key } });
  if (existing) throw new ServiceError("key_taken", `A workflow with key "${input.key}" already exists.`, 422);
  const def = await prisma.$transaction(async (tx) => {
    const d = await tx.workflowDefinition.create({
      data: {
        key: input.key, name: input.name, module: input.module, description: input.description ?? null,
        companyId: input.companyId ?? null, brandId: input.brandId ?? null, countryId: input.countryId ?? null,
        status: "draft", createdById: ctx.principal.userId,
      },
    });
    await tx.workflowVersion.create({
      data: { definitionId: d.id, version: 1, status: "draft", definitionJson: JSON.stringify(STARTER_SPEC), createdById: ctx.principal.userId, changeNote: "Initial draft" },
    });
    return d;
  });
  await audit(ctx, { action: "workflow.created", entityType: "WorkflowDefinition", entityId: def.id, summary: `${input.name} (${input.module})`, brandId: def.brandId, companyId: def.companyId });
  return def;
}

async function loadEditableDefinition(ctx: ActorContext, id: string): Promise<WorkflowDefinition> {
  const def = await prisma.workflowDefinition.findUnique({ where: { id } });
  if (!def || def.archivedAt) throw new ServiceError("not_found", "Workflow not found", 404);
  assertCan(ctx.principal, "workflows.edit", { companyId: def.companyId, brandId: def.brandId, countryId: def.countryId });
  return def;
}

/** Update a definition's metadata (name/description) — never its versions' meaning. */
export async function updateWorkflowMeta(ctx: ActorContext, id: string, raw: unknown): Promise<void> {
  const def = await loadEditableDefinition(ctx, id);
  const input = z.object({ name: z.string().trim().min(1).max(120).optional(), description: optionalString }).parse(raw);
  await prisma.workflowDefinition.update({ where: { id }, data: { ...(input.name ? { name: input.name } : {}), ...(input.description !== undefined ? { description: input.description ?? null } : {}) } });
  await audit(ctx, { action: "workflow.updated", entityType: "WorkflowDefinition", entityId: id, summary: def.name, brandId: def.brandId, companyId: def.companyId });
}

/** The single editable draft version of a definition (the only mutable spec). */
async function draftVersion(definitionId: string): Promise<WorkflowVersion | null> {
  return prisma.workflowVersion.findFirst({ where: { definitionId, status: "draft" }, orderBy: { version: "desc" } });
}

/**
 * Save the declarative spec into the definition's DRAFT version. Editing an
 * active version is impossible by construction — you must open a new revision
 * first — so live records never shift under an edit (§26).
 */
export async function saveWorkflowDraft(ctx: ActorContext, id: string, rawSpec: unknown, changeNote?: string): Promise<ValidationResult> {
  const def = await loadEditableDefinition(ctx, id);
  const draft = await draftVersion(id);
  if (!draft) throw new ServiceError("no_draft", "There is no draft to edit. Open a new revision first.", 422);
  const { spec, result } = parseAndValidate(rawSpec, await knownRefs());
  // We persist even an invalid draft (so authors can save work-in-progress), but
  // activation is what enforces validity. Store the normalized spec when parseable.
  await prisma.workflowVersion.update({
    where: { id: draft.id },
    data: { definitionJson: spec ? JSON.stringify(spec) : (typeof rawSpec === "string" ? rawSpec : JSON.stringify(rawSpec)), ...(changeNote !== undefined ? { changeNote } : {}) },
  });
  await audit(ctx, { action: "workflow.draft_saved", entityType: "WorkflowDefinition", entityId: id, summary: `${def.name} draft v${draft.version} (${result.ok ? "valid" : `${result.errors.length} error(s)`})`, brandId: def.brandId, companyId: def.companyId });
  return result;
}

/**
 * Open a NEW draft revision (max version + 1), seeded from the current active
 * spec (or the latest version). Leaves the active version — and every record
 * bound to it — untouched until the new one is explicitly activated.
 */
export async function openWorkflowRevision(ctx: ActorContext, id: string): Promise<WorkflowVersion> {
  const def = await loadEditableDefinition(ctx, id);
  const existingDraft = await draftVersion(id);
  if (existingDraft) throw new ServiceError("draft_exists", "A draft revision already exists — edit it instead.", 422);
  const latest = await prisma.workflowVersion.findFirst({ where: { definitionId: id }, orderBy: { version: "desc" } });
  const seedJson = latest?.definitionJson ?? JSON.stringify(STARTER_SPEC);
  const version = await prisma.workflowVersion.create({
    data: { definitionId: id, version: (latest?.version ?? 0) + 1, status: "draft", definitionJson: seedJson, createdById: ctx.principal.userId, changeNote: "New revision" },
  });
  await audit(ctx, { action: "workflow.revision_opened", entityType: "WorkflowDefinition", entityId: id, summary: `${def.name} v${version.version} draft`, brandId: def.brandId, companyId: def.companyId });
  return version;
}

/** Validate a specific version's spec against the live catalog (read-only). */
export async function validateWorkflowVersion(principal: Principal, definitionId: string, versionId: string): Promise<ValidationResult> {
  const def = await getWorkflow(principal, definitionId);
  if (!def) throw new ServiceError("not_found", "Workflow not found", 404);
  const version = await prisma.workflowVersion.findFirst({ where: { id: versionId, definitionId } });
  if (!version) throw new ServiceError("not_found", "Version not found", 404);
  const { result } = parseAndValidate(version.definitionJson, await knownRefs());
  return result;
}

/**
 * Activate a draft version. Validates first (invalid definitions can never
 * govern records), retires the previously-active version, and points the
 * definition at the new one. Existing instances keep their bound versionId.
 */
export async function activateWorkflowVersion(ctx: ActorContext, definitionId: string, versionId: string): Promise<void> {
  const def = await loadEditableDefinition(ctx, definitionId);
  const version = await prisma.workflowVersion.findFirst({ where: { id: versionId, definitionId } });
  if (!version) throw new ServiceError("not_found", "Version not found", 404);
  if (version.status === "active") return;
  if (version.status === "retired") throw new ServiceError("retired", "A retired version cannot be reactivated. Open a new revision.", 422);
  const { result } = parseAndValidate(version.definitionJson, await knownRefs());
  if (!result.ok) throw new ServiceError("invalid_definition", `Cannot activate: ${result.errors.join(" ")}`, 422, result);
  const now = new Date();
  await prisma.$transaction([
    prisma.workflowVersion.updateMany({ where: { definitionId, status: "active" }, data: { status: "retired", retiredAt: now } }),
    prisma.workflowVersion.update({ where: { id: versionId }, data: { status: "active", activatedAt: now, activatedById: ctx.principal.userId } }),
    prisma.workflowDefinition.update({ where: { id: definitionId }, data: { status: "active", currentVersionId: versionId } }),
  ]);
  await audit(ctx, { action: "workflow.activated", entityType: "WorkflowDefinition", entityId: definitionId, summary: `${def.name} v${version.version} activated`, brandId: def.brandId, companyId: def.companyId });
}

export async function archiveWorkflow(ctx: ActorContext, id: string): Promise<void> {
  const def = await loadEditableDefinition(ctx, id);
  const live = await prisma.workflowInstance.count({ where: { definitionId: id, status: "active" } });
  if (live > 0) throw new ServiceError("has_live_instances", `Cannot archive: ${live} record(s) are still running this workflow.`, 422);
  await prisma.workflowDefinition.update({ where: { id }, data: { archivedAt: new Date(), status: "archived" } });
  await audit(ctx, { action: "workflow.archived", entityType: "WorkflowDefinition", entityId: id, summary: def.name, brandId: def.brandId, companyId: def.companyId });
}

// ---------------------------------------------------------------------------
// INSTANCE RUNTIME (records governed by a bound version)
// ---------------------------------------------------------------------------
export interface StartInstanceInput {
  definitionKey?: string;
  definitionId?: string;
  entityType: string;
  entityId: string;
  scope?: { companyId?: string | null; brandId?: string | null; countryId?: string | null };
  actorLabel?: string;
}

function stageDueAt(stage: WorkflowStageSpec | undefined, from: Date): Date | null {
  if (!stage?.slaHours) return null;
  return new Date(from.getTime() + stage.slaHours * 3_600_000);
}

/**
 * Start (or return the existing) workflow instance for a record. Binds the
 * record to the definition's CURRENT active version. Idempotent per record
 * (one instance per entityType+entityId).
 */
export async function startWorkflowInstance(ctx: ActorContext, input: StartInstanceInput): Promise<WorkflowInstance> {
  const existing = await prisma.workflowInstance.findUnique({ where: { entityType_entityId: { entityType: input.entityType, entityId: input.entityId } } });
  if (existing) return existing;

  const def = input.definitionId
    ? await prisma.workflowDefinition.findUnique({ where: { id: input.definitionId } })
    : input.definitionKey
      ? await prisma.workflowDefinition.findUnique({ where: { key: input.definitionKey } })
      : null;
  if (!def || def.archivedAt) throw new ServiceError("not_found", "Workflow not found", 404);
  const active = await activeSpec(def.id);
  if (!active) throw new ServiceError("not_active", "This workflow has no active version.", 422);
  const start = initialStage(active.spec);
  if (!start) throw new ServiceError("invalid_definition", "The active version has no initial stage.", 500);

  const scope = input.scope ?? {};
  // The starter must be allowed to act on this record's scope.
  assertCan(ctx.principal, "workflows.edit", { companyId: scope.companyId ?? def.companyId, brandId: scope.brandId ?? def.brandId, countryId: scope.countryId ?? def.countryId });

  const now = new Date();
  const instance = await prisma.$transaction(async (tx) => {
    const inst = await tx.workflowInstance.create({
      data: {
        definitionId: def.id, versionId: active.version.id, entityType: input.entityType, entityId: input.entityId,
        currentStage: start.key, status: start.isTerminal ? "completed" : "active",
        companyId: scope.companyId ?? def.companyId, brandId: scope.brandId ?? def.brandId, countryId: scope.countryId ?? def.countryId,
        dueAt: stageDueAt(start, now), startedById: ctx.principal.userId, completedAt: start.isTerminal ? now : null,
      },
    });
    await tx.workflowTransitionLog.create({ data: { instanceId: inst.id, fromStage: null, toStage: start.key, transitionKey: "start", actorId: ctx.principal.userId, note: input.actorLabel ?? "Workflow started" } });
    return inst;
  });
  await audit(ctx, { action: "workflow.instance_started", entityType: "WorkflowInstance", entityId: instance.id, summary: `${def.name} → ${start.name}`, brandId: instance.brandId, companyId: instance.companyId });
  return instance;
}

export async function getInstance(principal: Principal, id: string) {
  const inst = await prisma.workflowInstance.findUnique({ where: { id }, include: { logs: { orderBy: { at: "desc" }, take: 100 }, definition: true, version: true } });
  if (!inst) return null;
  assertRecordInScope(principal, "workflows.view", inst, DIMS_CBC);
  return inst;
}

export async function getInstanceForEntity(principal: Principal, entityType: string, entityId: string) {
  const inst = await prisma.workflowInstance.findUnique({ where: { entityType_entityId: { entityType, entityId } }, include: { logs: { orderBy: { at: "desc" }, take: 100 }, definition: true, version: true } });
  if (!inst) return null;
  assertRecordInScope(principal, "workflows.view", inst, DIMS_CBC);
  return inst;
}

/**
 * Transitions the principal may perform from the instance's current stage —
 * filtered by each transition's declared permission (or the governed module's
 * edit) evaluated in the instance's scope. `module` is the definition.module.
 */
export function availableTransitions(principal: Principal, instance: WorkflowInstance, spec: WorkflowSpec, module: string): WorkflowTransitionSpec[] {
  const scope = { companyId: instance.companyId, brandId: instance.brandId, countryId: instance.countryId };
  return transitionsFrom(spec, instance.currentStage).filter((tr) => canOnScope(principal, tr.permission ?? `${module}.edit`, scope));
}

function canOnScope(principal: Principal, perm: string, scope: { companyId: string | null; brandId: string | null; countryId: string | null }): boolean {
  try {
    assertRecordInScope(principal, perm, scope, DIMS_CBC);
    return true;
  } catch {
    return false;
  }
}

export const transitionInputSchema = z.object({
  transitionKey: z.string().min(1),
  note: optionalString,
  fieldValues: z.record(z.string(), z.string()).optional(),
});

/**
 * Perform a transition on a live instance. Enforces, server-side and in the
 * record's scope: the transition's permission, the source stage's required
 * fields, required documents (attachments) and required approvals. Records an
 * append-only transition log, recomputes the SLA deadline, completes the
 * instance on reaching a terminal stage, and notifies the next responsible roles.
 */
export async function performTransition(ctx: ActorContext, instanceId: string, raw: unknown): Promise<WorkflowInstance> {
  const input = transitionInputSchema.parse(raw);
  const inst = await prisma.workflowInstance.findUnique({ where: { id: instanceId }, include: { definition: true, version: true } });
  if (!inst) throw new ServiceError("not_found", "Workflow instance not found", 404);
  if (inst.status !== "active") throw new ServiceError("not_active", "This workflow instance is already closed.", 422);

  const spec = specOf(inst.version);
  const scope = { companyId: inst.companyId, brandId: inst.brandId, countryId: inst.countryId };
  const fromStage = stageByKey(spec, inst.currentStage);
  const transition = transitionsFrom(spec, inst.currentStage).find((tr) => tr.key === input.transitionKey);
  if (!transition) throw new ServiceError("invalid_transition", "That transition is not available from the current stage.", 422);
  const toStage = stageByKey(spec, transition.to);
  if (!toStage) throw new ServiceError("invalid_definition", "Transition targets a missing stage.", 500);

  // Permission: the transition's declared permission (or the governed module's
  // edit) — evaluated against THIS record's scope. Fail-closed.
  const perm = transition.permission ?? `${inst.definition.module}.edit`;
  assertCan(ctx.principal, perm, scope);

  // Gate: required fields to LEAVE the current stage.
  const collected: Record<string, string> = { ...(inst.dataJson ? safeJson(inst.dataJson) : {}), ...(input.fieldValues ?? {}) };
  for (const f of fromStage?.requiredFields ?? []) {
    if (!collected[f] || !collected[f].trim()) throw new ServiceError("missing_field", `The field "${f}" is required before leaving "${fromStage?.name}".`, 422);
  }
  // Gate: required documents — count attachments on the governed record.
  const needDocs = fromStage?.requiredDocuments ?? [];
  if (needDocs.length > 0) {
    const attached = await prisma.fileAttachment.count({ where: { entityType: inst.entityType, entityId: inst.entityId } });
    if (attached < needDocs.length) throw new ServiceError("missing_documents", `This stage requires ${needDocs.length} document(s) (${needDocs.join(", ")}); ${attached} attached.`, 422);
  }
  // Gate: required approvals — count approved approval requests linked to the record.
  if ((fromStage?.requiredApprovals ?? 0) > 0) {
    const approved = await prisma.approvalRequest.count({ where: { entityType: inst.entityType, entityId: inst.entityId, status: "approved" } });
    if (approved < (fromStage?.requiredApprovals ?? 0)) throw new ServiceError("missing_approvals", `This stage requires ${fromStage?.requiredApprovals} approval(s); ${approved} recorded.`, 422);
  }

  const now = new Date();
  const terminal = !!toStage.isTerminal;
  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.workflowInstance.update({
      where: { id: instanceId },
      data: {
        currentStage: toStage.key, status: terminal ? "completed" : "active",
        dataJson: Object.keys(collected).length ? JSON.stringify(collected) : inst.dataJson,
        dueAt: terminal ? null : stageDueAt(toStage, now), escalatedAt: null, completedAt: terminal ? now : null,
      },
    });
    await tx.workflowTransitionLog.create({ data: { instanceId, fromStage: inst.currentStage, toStage: toStage.key, transitionKey: transition.key, actorId: ctx.principal.userId, note: input.note ?? transition.name } });
    return u;
  });
  await audit(ctx, { action: "workflow.transitioned", entityType: "WorkflowInstance", entityId: instanceId, summary: `${fromStage?.name ?? inst.currentStage} → ${toStage.name} (${transition.name})`, brandId: inst.brandId, companyId: inst.companyId });

  // Notify the next stage's responsible roles (in scope).
  if (!terminal && (toStage.responsibleRoles?.length ?? 0) > 0) {
    const recipients = await usersInRolesForScope(toStage.responsibleRoles!, scope);
    await notify(recipients, {
      type: "workflow.stage_ready", title: `${inst.definition.name}: ${toStage.name}`,
      body: `A ${inst.definition.module} record has reached "${toStage.name}" and needs your attention.`,
      entityType: inst.entityType, entityId: inst.entityId,
    }, ctx.principal.userId);
  }
  return updated;
}

function safeJson(s: string): Record<string, string> {
  try { const v = JSON.parse(s); return v && typeof v === "object" ? v : {}; } catch { return {}; }
}

/** Users holding any of the given role keys whose assignment scope matches. */
async function usersInRolesForScope(roleKeys: string[], scope: { companyId: string | null; brandId: string | null; countryId: string | null }): Promise<string[]> {
  if (roleKeys.length === 0) return [];
  const assignments = await prisma.roleAssignment.findMany({
    where: {
      role: { key: { in: roleKeys } },
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      AND: [
        { OR: [{ companyId: null }, { companyId: scope.companyId }] },
        { OR: [{ brandId: null }, { brandId: scope.brandId }] },
        { OR: [{ countryId: null }, { countryId: scope.countryId }] },
      ],
    },
    select: { userId: true },
    take: 200,
  });
  return [...new Set(assignments.map((a) => a.userId))];
}

/**
 * The active workflow governing a module for a given scope, if any. Prefers the
 * most specific scope match (exact company/brand/country over group-wide nulls).
 */
export async function findActiveWorkflowForModule(module: string, scope: { companyId?: string | null; brandId?: string | null; countryId?: string | null }): Promise<WorkflowDefinition | null> {
  const candidates = await prisma.workflowDefinition.findMany({
    where: {
      module, status: "active", archivedAt: null, currentVersionId: { not: null },
      AND: [
        { OR: [{ companyId: null }, { companyId: scope.companyId ?? null }] },
        { OR: [{ brandId: null }, { brandId: scope.brandId ?? null }] },
        { OR: [{ countryId: null }, { countryId: scope.countryId ?? null }] },
      ],
    },
    take: 20,
  });
  if (candidates.length === 0) return null;
  const specificity = (d: WorkflowDefinition) => (d.companyId ? 1 : 0) + (d.brandId ? 1 : 0) + (d.countryId ? 1 : 0);
  return candidates.sort((a, b) => specificity(b) - specificity(a))[0];
}

// ---------------------------------------------------------------------------
// INSTANCE LISTING (operational monitor)
// ---------------------------------------------------------------------------
export const instanceQuerySchema = listQuerySchema.extend({
  definitionId: z.string().optional(),
  status: z.string().optional(),
  overdue: z.coerce.boolean().optional(),
});
export type InstanceQuery = z.infer<typeof instanceQuerySchema>;

export async function listInstances(principal: Principal, query: InstanceQuery) {
  const scope = scopeWhereFor(principal, "workflows.view", DIMS_CBC);
  const where: Record<string, unknown> = {
    ...scope,
    ...(query.definitionId ? { definitionId: query.definitionId } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.overdue ? { status: "active", dueAt: { lt: new Date() } } : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.workflowInstance.findMany({ where, orderBy: [{ dueAt: "asc" }, { updatedAt: "desc" }], include: { definition: true }, skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
    prisma.workflowInstance.count({ where }),
  ]);
  return { rows, total };
}

// ---------------------------------------------------------------------------
// SLA ESCALATION JOB (idempotent; self-registers a BackgroundJob row)
// ---------------------------------------------------------------------------
/**
 * Scan active instances whose SLA deadline has passed and whose current stage
 * declares an escalation, notifying the escalation roles once per stage entry
 * (escalatedAt guards against re-firing). Safe to run repeatedly (cron 0 * * * *).
 */
export async function escalateOverdueInstances(actorId: string, now: Date = new Date()): Promise<{ scanned: number; escalated: number }> {
  await prisma.backgroundJob.upsert({
    where: { id: "workflow-escalations" },
    update: { lastRunAt: now, status: "success" },
    create: { id: "workflow-escalations", name: "Workflow SLA escalations", type: "recurring", scheduleCron: "0 * * * *", status: "success", lastRunAt: now },
  }).catch(() => {});

  const overdue = await prisma.workflowInstance.findMany({
    where: { status: "active", dueAt: { lt: now }, escalatedAt: null },
    include: { definition: true, version: true },
    take: 500,
  });
  let escalated = 0;
  for (const inst of overdue) {
    let spec: WorkflowSpec;
    try { spec = specOf(inst.version); } catch { continue; }
    const stage = stageByKey(spec, inst.currentStage);
    if (!stage?.escalation) continue;
    const scope = { companyId: inst.companyId, brandId: inst.brandId, countryId: inst.countryId };
    const roles = stage.escalation.toRoles?.length ? stage.escalation.toRoles : (stage.responsibleRoles ?? []);
    const recipients = await usersInRolesForScope(roles, scope);
    await notify(recipients, {
      type: "workflow.escalation", title: `Overdue: ${inst.definition.name} — ${stage.name}`,
      body: stage.escalation.note ?? `A ${inst.definition.module} record has been in "${stage.name}" past its SLA.`,
      entityType: inst.entityType, entityId: inst.entityId,
    });
    await prisma.workflowInstance.update({ where: { id: inst.id }, data: { escalatedAt: now } });
    await prisma.auditLog.create({ data: { actorId, action: "workflow.escalated", entityType: "WorkflowInstance", entityId: inst.id, summary: `SLA breach in "${stage.name}"`, brandId: inst.brandId, companyId: inst.companyId } }).catch(() => {});
    escalated++;
  }
  await prisma.systemEvent.create({ data: { type: "integration", level: escalated ? "warning" : "info", message: `workflow-escalations: ${escalated}/${overdue.length} escalated`, metaJson: JSON.stringify({ scanned: overdue.length, escalated }) } }).catch(() => {});
  return { scanned: overdue.length, escalated };
}

// re-export spec helpers used by pages/actions
export { validateSpec, parseSpec, initialStage, stageByKey, transitionsFrom };
export type { WorkflowSpec, ValidationResult, WorkflowTransitionSpec, WorkflowStageSpec };
