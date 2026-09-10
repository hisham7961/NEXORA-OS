import { prisma } from "@/lib/db";

/**
 * AUDIT (§31) — record every sensitive business action. The service layer calls
 * this; it never throws into the caller (audit failures must not break the
 * operation, but are surfaced to the console for the ops center).
 */
export interface AuditInput {
  actorId?: string | null;
  action: string; // e.g. "campaign.updated", "permission.granted"
  entityType: string;
  entityId?: string | null;
  summary?: string;
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
  companyId?: string | null;
  brandId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
}

export async function writeAudit(input: AuditInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: input.actorId ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        summary: input.summary ?? null,
        oldValuesJson: input.oldValues ? JSON.stringify(input.oldValues) : null,
        newValuesJson: input.newValues ? JSON.stringify(input.newValues) : null,
        companyId: input.companyId ?? null,
        brandId: input.brandId ?? null,
        ip: input.ip ?? null,
        userAgent: input.userAgent ?? null,
      },
    });
  } catch (err) {
    const { logger } = await import("@/lib/log");
    logger.error("failed to write audit log", { action: input.action, err });
  }
}

/** Shallow diff helper for building old/new value maps on updates. */
export function diff<T extends Record<string, unknown>>(before: T, after: Partial<T>) {
  const oldValues: Record<string, unknown> = {};
  const newValues: Record<string, unknown> = {};
  for (const key of Object.keys(after)) {
    if (before[key] !== after[key]) {
      oldValues[key] = before[key];
      newValues[key] = after[key as keyof T];
    }
  }
  return { oldValues, newValues, changed: Object.keys(newValues).length > 0 };
}
