import { prisma } from "@/lib/db";
import { assertCan, type ActorContext } from "@/domain/mutation";
import { ServiceError } from "@/lib/api/handler";
import type { Principal } from "@/lib/permissions/engine";
import { can } from "@/lib/permissions/engine";

/**
 * Shared accounting authorization + company helpers (Phase 3). Financial access is
 * a separate privilege (§70): every accounting action is gated by an accounting/*
 * permission in the target legal company's scope — operational Brand/Campaign
 * visibility never implies it. Company books are legally separated (§3/§5).
 */
export function assertFinance(ctx: ActorContext, key: string, companyId: string): void {
  assertCan(ctx.principal, key, { companyId });
}

export function canFinance(principal: Principal, key: string, companyId: string): boolean {
  return can(principal, key, { companyId });
}

/** The company's accounting settings, or a ServiceError if not yet configured. */
export async function requireSettings(companyId: string) {
  const s = await prisma.companyAccountingSettings.findUnique({ where: { companyId } });
  if (!s) throw new ServiceError("no_accounting_settings", "This company has no accounting settings yet. Configure accounting first.", 422);
  return s;
}

export async function companyBaseCurrency(companyId: string): Promise<string> {
  const s = await prisma.companyAccountingSettings.findUnique({ where: { companyId }, select: { baseCurrency: true } });
  return s?.baseCurrency ?? "KWD";
}
