import { prisma } from "@/lib/db";
import { canAnywhere, ForbiddenError, type Principal } from "@/lib/permissions/engine";
import { ServiceError } from "@/lib/api/handler";
import { audit, notify, type ActorContext } from "@/domain/mutation";

/** Daily compliance dashboard (§8). */
export interface ComplianceRow {
  id: string;
  userName: string;
  templateName: string;
  status: string;
  done: number;
  total: number;
  verified: boolean;
}

export async function getDailyCompliance(_principal: Principal) {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = new Date(startOfToday.getTime() + 86_400_000);

  const [instances, templates] = await Promise.all([
    prisma.checklistInstance.findMany({
      where: { date: { gte: startOfToday, lt: endOfToday } },
      include: { template: true, items: true },
    }),
    prisma.checklistTemplate.findMany({ where: { isActive: true }, include: { _count: { select: { items: true, assignments: true } } } }),
  ]);

  const userIds = [...new Set(instances.map((i) => i.userId))];
  const users = userIds.length ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } }) : [];
  const nameMap = new Map(users.map((u) => [u.id, u.name]));

  const rows: ComplianceRow[] = instances.map((i) => ({
    id: i.id,
    userName: nameMap.get(i.userId) ?? "—",
    templateName: i.template.name,
    status: i.status,
    done: i.items.filter((it) => it.isDone).length,
    total: i.items.length,
    verified: !!i.verifiedById,
  }));

  const summary = {
    total: rows.length,
    complete: rows.filter((r) => r.status === "complete").length,
    pending: rows.filter((r) => r.status === "pending").length,
    late: rows.filter((r) => r.status === "late").length,
    missed: rows.filter((r) => r.status === "missed").length,
    pendingVerification: rows.filter((r) => (r.status === "complete" || r.status === "late") && !r.verified).length,
  };

  return { rows, templates, summary };
}

// ---------------------------------------------------------------------------
// EXECUTION (§8, Phase 2 Part H) — employees complete their OWN checks with the
// required evidence; supervisors verify. Nobody completes a check outside their
// own authorized assignment.
// ---------------------------------------------------------------------------

/** Load an instance for execution/viewing, with per-item required flags. */
export async function getInstanceForExecution(principal: Principal, id: string) {
  const instance = await prisma.checklistInstance.findUnique({
    where: { id },
    include: { template: { include: { items: true } }, items: true },
  });
  if (!instance) return null;
  const isOwner = instance.userId === principal.userId;
  const isManager = canAnywhere(principal, "daily_checks.manage");
  if (!isOwner && !isManager) throw new ForbiddenError("daily_checks.view");

  const templateItemById = new Map(instance.template.items.map((t) => [t.id, t]));
  const items = instance.items.map((it) => {
    const t = it.templateItemId ? templateItemById.get(it.templateItemId) : undefined;
    return {
      id: it.id,
      text: it.text,
      isDone: it.isDone,
      note: it.note,
      link: it.link,
      doneAt: it.doneAt,
      requiresNote: t?.requiresNote ?? false,
      requiresLink: t?.requiresLink ?? false,
      requiresAttachment: t?.requiresAttachment ?? false,
      requiresApproval: t?.requiresApproval ?? false,
    };
  });
  return { instance, template: instance.template, items, isOwner, isManager };
}

/** Assert the actor owns this instance (only the assignee completes it, §8). */
async function loadOwnInstance(ctx: ActorContext, instanceId: string) {
  const instance = await prisma.checklistInstance.findUnique({ where: { id: instanceId }, include: { template: true } });
  if (!instance) throw new ServiceError("not_found", "Checklist not found", 404);
  if (instance.userId !== ctx.principal.userId) {
    throw new ForbiddenError("daily_checks.complete_own");
  }
  return instance;
}

export async function completeChecklistItem(
  ctx: ActorContext,
  instanceId: string,
  itemId: string,
  input: { done: boolean; note?: string; link?: string },
): Promise<void> {
  const instance = await loadOwnInstance(ctx, instanceId);
  const item = await prisma.checklistInstanceItem.findUnique({ where: { id: itemId } });
  if (!item || item.instanceId !== instanceId) throw new ServiceError("not_found", "Check item not found", 404);

  const template = await prisma.checklistTemplateItem.findUnique({ where: { id: item.templateItemId ?? "" } }).catch(() => null);
  if (input.done && template) {
    if (template.requiresNote && !input.note?.trim()) throw new ServiceError("note_required", "This check requires a confirmation note.", 422);
    if ((template.requiresLink || template.requiresAttachment) && !input.link?.trim()) {
      throw new ServiceError("evidence_required", "This check requires a link/evidence.", 422);
    }
  }

  await prisma.checklistInstanceItem.update({
    where: { id: itemId },
    data: {
      isDone: input.done,
      note: input.note?.trim() || null,
      link: input.link?.trim() || null,
      doneAt: input.done ? new Date() : null,
    },
  });
  await audit(ctx, { action: input.done ? "daily_check.item_done" : "daily_check.item_undone", entityType: "ChecklistInstance", entityId: instanceId, summary: item.text, brandId: instance.template.brandId });
}

export async function submitChecklistInstance(ctx: ActorContext, instanceId: string): Promise<void> {
  const instance = await loadOwnInstance(ctx, instanceId);
  const items = await prisma.checklistInstanceItem.findMany({ where: { instanceId } });
  const done = items.filter((i) => i.isDone).length;
  const total = items.length;
  const now = new Date();
  const dueEnd = new Date(instance.date.getTime() + 86_400_000);
  const late = now.getTime() > dueEnd.getTime();
  const status = done < total ? (late ? "late" : "pending") : late ? "late" : "complete";

  await prisma.checklistInstance.update({
    where: { id: instanceId },
    data: { status, completedAt: done === total ? now : null, score: total ? Math.round((done / total) * 100) : 0 },
  });
  await audit(ctx, { action: "daily_check.submitted", entityType: "ChecklistInstance", entityId: instanceId, summary: `${done}/${total} complete`, brandId: instance.template.brandId, newValues: { status } });
  await notify([instance.template.createdById], { type: "daily_check.submitted", title: "Daily checks submitted", body: `${instance.template.name}: ${done}/${total}`, entityType: "ChecklistInstance", entityId: instanceId }, ctx.principal.userId);
}

export async function verifyChecklistInstance(ctx: ActorContext, instanceId: string): Promise<void> {
  if (!canAnywhere(ctx.principal, "daily_checks.manage")) throw new ForbiddenError("daily_checks.manage");
  const instance = await prisma.checklistInstance.findUnique({ where: { id: instanceId }, include: { template: true } });
  if (!instance) throw new ServiceError("not_found", "Checklist not found", 404);
  await prisma.checklistInstance.update({ where: { id: instanceId }, data: { verifiedById: ctx.principal.userId } });
  await audit(ctx, { action: "daily_check.verified", entityType: "ChecklistInstance", entityId: instanceId, summary: instance.template.name, brandId: instance.template.brandId });
  await notify([instance.userId], { type: "daily_check.verified", title: "Your daily checks were verified", body: instance.template.name, entityType: "ChecklistInstance", entityId: instanceId }, ctx.principal.userId);
}

// ---------------------------------------------------------------------------
// GENERATOR (§8, Phase 2 Part I) — the real recurring generator. Idempotent
// (unique (templateId,userId,date)), logged, retryable, visible in System Jobs.
// ---------------------------------------------------------------------------

function scheduleMatches(scheduleType: string, configJson: string | null, date: Date): boolean {
  let config: { days?: number[]; dayOfWeek?: number; dayOfMonth?: number } = {};
  if (configJson) {
    try {
      config = JSON.parse(configJson);
    } catch {
      config = {};
    }
  }
  switch (scheduleType) {
    case "daily":
      return true;
    case "weekdays":
      return (config.days ?? [0, 1, 2, 3, 4]).includes(date.getDay());
    case "weekly":
      return (config.dayOfWeek ?? 0) === date.getDay();
    case "monthly":
      return (config.dayOfMonth ?? 1) === date.getDate();
    default:
      return false; // custom schedules require explicit dates
  }
}

const GENERATOR_JOB = "Generate recurring daily checks";

/**
 * Generate today's (or a given day's) checklist instances for every active
 * template + active assignment whose schedule matches. Safe to re-run.
 */
export async function generateDailyChecks(actorId: string | null, day?: Date): Promise<{ created: number; skipped: number }> {
  const base = day ?? new Date();
  const date = new Date(base.getFullYear(), base.getMonth(), base.getDate());

  // Mark the job running (visible in System Jobs / Ops Center).
  const job = await prisma.backgroundJob.findFirst({ where: { name: GENERATOR_JOB } });
  if (job) await prisma.backgroundJob.update({ where: { id: job.id }, data: { status: "running", lastRunAt: new Date() } });

  let created = 0;
  let skipped = 0;
  try {
    const templates = await prisma.checklistTemplate.findMany({
      where: { isActive: true, archivedAt: null },
      include: { items: { orderBy: { order: "asc" } }, assignments: { where: { isActive: true } } },
    });

    for (const template of templates) {
      if (!scheduleMatches(template.scheduleType, template.scheduleConfigJson, date)) continue;
      for (const a of template.assignments) {
        if (a.startDate && a.startDate > date) continue;
        if (a.endDate && a.endDate < date) continue;

        // Idempotent: skip if the instance already exists.
        const existing = await prisma.checklistInstance.findUnique({
          where: { templateId_userId_date: { templateId: template.id, userId: a.userId, date } },
        });
        if (existing) {
          skipped++;
          continue;
        }
        await prisma.checklistInstance.create({
          data: {
            templateId: template.id,
            userId: a.userId,
            date,
            status: "pending",
            items: { create: template.items.map((it) => ({ templateItemId: it.id, text: it.text })) },
          },
        });
        created++;
      }
    }

    if (job) {
      const nextRun = new Date(date.getTime() + 86_400_000);
      await prisma.backgroundJob.update({ where: { id: job.id }, data: { status: "success", nextRunAt: nextRun, lastError: null } });
    }
    await prisma.systemEvent.create({
      data: { type: "health", level: "info", message: `Daily-check generator: ${created} created, ${skipped} skipped for ${date.toISOString().slice(0, 10)}`, metaJson: JSON.stringify({ created, skipped }) },
    });
    if (actorId) {
      await prisma.auditLog.create({ data: { actorId, action: "job.daily_checks_generated", entityType: "BackgroundJob", summary: `${created} created, ${skipped} skipped` } });
    }
  } catch (err) {
    if (job) await prisma.backgroundJob.update({ where: { id: job.id }, data: { status: "failed", lastError: String(err) } });
    await prisma.systemEvent.create({ data: { type: "error", level: "error", message: `Daily-check generator failed: ${String(err)}` } });
    throw err;
  }

  return { created, skipped };
}
