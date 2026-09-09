import { z } from "zod";
import type { Principal } from "@/lib/permissions/engine";
import { prisma } from "@/lib/db";
import { assertCan, audit, type ActorContext } from "@/domain/mutation";
import { ServiceError } from "@/lib/api/handler";
import { assertFinance } from "./common";

/**
 * Fiscal years and accounting periods (§7/§8). Periods carry the posting-control
 * status machine: open → soft_closed → closed → locked. Posting-date validation
 * against period status happens server-side in the posting engine. No overlapping
 * fiscal years per company.
 */
export const fiscalYearSchema = z.object({
  name: z.string().trim().min(1).max(60),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
});

export async function listFiscalYears(principal: Principal, companyId: string) {
  assertCan(principal, "periods.view", { companyId });
  return prisma.fiscalYear.findMany({ where: { companyId }, orderBy: { startDate: "desc" }, include: { periods: { orderBy: { startDate: "asc" } } } });
}

export async function createFiscalYear(ctx: ActorContext, companyId: string, raw: unknown) {
  assertFinance(ctx, "periods.manage", companyId);
  const input = fiscalYearSchema.parse(raw);
  if (input.endDate <= input.startDate) throw new ServiceError("bad_range", "End date must be after start date.", 422);
  const overlap = await prisma.fiscalYear.findFirst({ where: { companyId, startDate: { lte: input.endDate }, endDate: { gte: input.startDate } } });
  if (overlap) throw new ServiceError("overlap", `Overlaps fiscal year "${overlap.name}".`, 422);

  const fy = await prisma.$transaction(async (tx) => {
    const year = await tx.fiscalYear.create({ data: { companyId, name: input.name, startDate: input.startDate, endDate: input.endDate, status: "open", createdById: ctx.principal.userId } });
    // Generate monthly periods spanning the year.
    const periods: { fiscalYearId: string; companyId: string; name: string; startDate: Date; endDate: Date }[] = [];
    const cursor = new Date(input.startDate);
    while (cursor <= input.endDate) {
      const pStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
      const pEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
      periods.push({ fiscalYearId: year.id, companyId, name: pStart.toLocaleString("en", { month: "short", year: "numeric" }), startDate: pStart < input.startDate ? input.startDate : pStart, endDate: pEnd > input.endDate ? input.endDate : pEnd });
      cursor.setMonth(cursor.getMonth() + 1);
    }
    await tx.accountingPeriod.createMany({ data: periods });
    return year;
  });
  await audit(ctx, { action: "fiscal_year.created", entityType: "FiscalYear", entityId: fy.id, summary: `${input.name}`, companyId });
  return fy;
}

const PERIOD_STATUSES = ["open", "soft_closed", "closed", "locked"] as const;

export async function setPeriodStatus(ctx: ActorContext, periodId: string, status: (typeof PERIOD_STATUSES)[number], note?: string): Promise<void> {
  const period = await prisma.accountingPeriod.findUnique({ where: { id: periodId }, include: { fiscalYear: true } });
  if (!period) throw new ServiceError("not_found", "Period not found", 404);
  const companyId = period.fiscalYear.companyId;
  // Reopening a closed/locked period is an elevated action (§65).
  const isReopen = (period.status === "closed" || period.status === "locked") && (status === "open" || status === "soft_closed");
  if (isReopen) {
    assertCan(ctx.principal, "periods.reopen", { companyId });
    if (!note?.trim()) throw new ServiceError("reason_required", "Reopening a period requires a reason.", 422);
  } else {
    assertFinance(ctx, "periods.manage", companyId);
  }
  await prisma.accountingPeriod.update({
    where: { id: periodId },
    data: {
      status,
      ...(status === "closed" || status === "locked" ? { closedById: ctx.principal.userId, closedAt: new Date() } : {}),
      ...(isReopen ? { reopenedById: ctx.principal.userId, reopenNote: note ?? null, closedById: null, closedAt: null } : {}),
    },
  });
  await audit(ctx, { action: isReopen ? "period.reopened" : `period.${status}`, entityType: "AccountingPeriod", entityId: periodId, summary: `${period.name} → ${status}${note ? ` (${note})` : ""}`, companyId });
}

/**
 * Resolve the period a posting date falls into, and assert it accepts a post.
 * Used by the posting engine. `elevated` allows posting into a soft-closed period.
 */
export async function assertOpenPeriod(companyId: string, postingDate: Date, elevated: boolean): Promise<string | null> {
  const settings = await prisma.companyAccountingSettings.findUnique({ where: { companyId }, select: { lockDate: true, softCloseDate: true } });
  if (settings?.lockDate && postingDate <= settings.lockDate) throw new ServiceError("locked", "The posting date is on or before the accounting lock date.", 422);
  const period = await prisma.accountingPeriod.findFirst({ where: { companyId, startDate: { lte: postingDate }, endDate: { gte: postingDate } } });
  if (!period) return null; // no period defined — allowed (caller may still require one)
  if (period.status === "locked") throw new ServiceError("period_locked", `Period "${period.name}" is locked.`, 422);
  if (period.status === "closed") throw new ServiceError("period_closed", `Period "${period.name}" is closed.`, 422);
  if (period.status === "soft_closed" && !elevated) throw new ServiceError("period_soft_closed", `Period "${period.name}" is soft-closed — only authorized finance users may post.`, 422);
  return period.id;
}
