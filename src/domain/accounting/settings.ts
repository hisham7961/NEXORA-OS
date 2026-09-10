import { z } from "zod";
import type { Principal } from "@/lib/permissions/engine";
import { prisma } from "@/lib/db";
import { assertCan, audit, type ActorContext } from "@/domain/mutation";
import { ServiceError } from "@/lib/api/handler";
import { assertFinance } from "./common";

/**
 * Company accounting settings (§4). Editable only by accounting managers; every
 * change audited. System-account mappings are stored as account IDs and validated
 * for company + type compatibility (§6) — never resolved by English name.
 */
const SYSTEM_ACCOUNT_FIELDS = [
  "receivableAccountId", "payableAccountId", "revenueAccountId", "cogsAccountId", "inventoryAccountId",
  "bankClearingAccountId", "cashAccountId", "inputTaxAccountId", "outputTaxAccountId",
  "retainedEarningsAccountId", "fxGainAccountId", "fxLossAccountId", "suspenseAccountId", "roundingAccountId",
  "roundingAdjustmentAccountId",
] as const;

export const settingsSchema = z.object({
  baseCurrency: z.string().length(3).optional(),
  fiscalYearStartMonth: z.coerce.number().int().min(1).max(12).optional(),
  timezone: z.string().optional(),
  roundingPolicy: z.enum(["half_up", "half_even", "down", "up"]).optional(),
  journalPrefix: z.string().max(8).optional(),
  invoicePrefix: z.string().max(8).optional(),
  billPrefix: z.string().max(8).optional(),
  paymentPrefix: z.string().max(8).optional(),
  defaultPaymentTerms: z.coerce.number().int().min(0).max(365).optional(),
  lockDate: z.preprocess((v) => (v ? new Date(v as string) : v === null ? null : undefined), z.date().nullable().optional()),
  softCloseDate: z.preprocess((v) => (v ? new Date(v as string) : v === null ? null : undefined), z.date().nullable().optional()),
  ...Object.fromEntries(SYSTEM_ACCOUNT_FIELDS.map((f) => [f, z.string().nullable().optional()])),
});

export async function getAccountingSettings(principal: Principal, companyId: string) {
  assertCan(principal, "accounting.view", { companyId });
  return prisma.companyAccountingSettings.findUnique({ where: { companyId } });
}

export async function upsertAccountingSettings(ctx: ActorContext, companyId: string, raw: unknown) {
  assertFinance(ctx, "accounting.manage", companyId);
  const input = settingsSchema.parse(raw);

  // Validate any system-account mapping belongs to this company (§6).
  for (const f of SYSTEM_ACCOUNT_FIELDS) {
    const val = (input as Record<string, unknown>)[f] as string | null | undefined;
    if (val) {
      const acct = await prisma.account.findUnique({ where: { id: val } });
      if (!acct || acct.companyId !== companyId) throw new ServiceError("bad_account", `Account for ${f} must belong to this company.`, 422);
      // Accounts that receive automatic postings must be active and postable.
      if (f === "roundingAdjustmentAccountId" && (!acct.isActive || acct.archivedAt || !acct.allowPosting)) throw new ServiceError("bad_account", "The rounding adjustment account must be an active, postable account.", 422);
    }
  }

  const data = Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined));
  const settings = await prisma.companyAccountingSettings.upsert({
    where: { companyId },
    create: { companyId, ...data },
    update: data,
  });
  // Mark mapped accounts as system-protected.
  const mapped = SYSTEM_ACCOUNT_FIELDS.map((f) => (input as Record<string, unknown>)[f]).filter((v): v is string => typeof v === "string");
  if (mapped.length) await prisma.account.updateMany({ where: { id: { in: mapped } }, data: { isSystem: true } });

  await audit(ctx, { action: "accounting.settings_updated", entityType: "CompanyAccountingSettings", entityId: settings.id, summary: "accounting settings updated", companyId });
  return settings;
}
