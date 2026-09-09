import { prisma } from "@/lib/db";
import { audit, type ActorContext } from "@/domain/mutation";
import { ServiceError } from "@/lib/api/handler";
import { assertFinance } from "./common";
import { normalBalanceFor } from "./accounts";

/**
 * One-click accounting bootstrap for a legal company (§5/§106/§107): default
 * settings, a standard hierarchical chart of accounts, the standard journals, and
 * the system-account mappings — so a company is ledger-ready without seed scripts.
 * Idempotent-ish: refuses if the company already has settings.
 */
interface TemplateAccount { code: string; name: string; type: string; subtype?: string; system?: keyof typeof SYSTEM_KEYS }

const SYSTEM_KEYS = {
  receivableAccountId: 1, payableAccountId: 1, revenueAccountId: 1, cogsAccountId: 1, inventoryAccountId: 1,
  bankClearingAccountId: 1, cashAccountId: 1, inputTaxAccountId: 1, outputTaxAccountId: 1,
  retainedEarningsAccountId: 1, fxGainAccountId: 1, fxLossAccountId: 1, suspenseAccountId: 1, roundingAccountId: 1,
} as const;

const CHART: TemplateAccount[] = [
  { code: "1000", name: "Cash", type: "asset", subtype: "cash", system: "cashAccountId" },
  { code: "1010", name: "Bank", type: "asset", subtype: "bank", system: "bankClearingAccountId" },
  { code: "1100", name: "Accounts Receivable", type: "asset", subtype: "ar", system: "receivableAccountId" },
  { code: "1200", name: "Inventory", type: "asset", subtype: "inventory", system: "inventoryAccountId" },
  { code: "1300", name: "Prepayments", type: "asset", subtype: "prepayment" },
  { code: "1400", name: "Input Tax (Recoverable)", type: "asset", subtype: "tax_payable", system: "inputTaxAccountId" },
  { code: "1500", name: "Fixed Assets", type: "asset", subtype: "fixed_asset" },
  { code: "2000", name: "Accounts Payable", type: "liability", subtype: "ap", system: "payableAccountId" },
  { code: "2100", name: "Accrued Expenses", type: "liability", subtype: "accrued" },
  { code: "2200", name: "Output Tax Payable", type: "liability", subtype: "tax_payable", system: "outputTaxAccountId" },
  { code: "2300", name: "Loans", type: "liability", subtype: "loan" },
  { code: "3000", name: "Share Capital", type: "equity", subtype: "capital" },
  { code: "3100", name: "Retained Earnings", type: "equity", subtype: "retained_earnings", system: "retainedEarningsAccountId" },
  { code: "4000", name: "Sales Revenue", type: "revenue", subtype: "sales", system: "revenueAccountId" },
  { code: "4100", name: "Sales Returns", type: "revenue", subtype: "sales_returns" },
  { code: "4200", name: "Discounts", type: "revenue", subtype: "discount" },
  { code: "4900", name: "Other Income", type: "other_income" },
  { code: "5000", name: "Cost of Goods Sold", type: "cogs", subtype: "cogs", system: "cogsAccountId" },
  { code: "6000", name: "Marketing Expense", type: "expense", subtype: "marketing" },
  { code: "6100", name: "Shipping Expense", type: "expense", subtype: "shipping" },
  { code: "6200", name: "Payroll Expense", type: "expense", subtype: "payroll" },
  { code: "6300", name: "Professional Fees", type: "expense", subtype: "professional_fees" },
  { code: "6400", name: "Rent", type: "expense", subtype: "rent" },
  { code: "6500", name: "Utilities", type: "expense", subtype: "utilities" },
  { code: "6900", name: "Other Expenses", type: "other_expense" },
  { code: "7000", name: "FX Gain", type: "other_income", subtype: "fx", system: "fxGainAccountId" },
  { code: "7100", name: "FX Loss", type: "other_expense", subtype: "fx", system: "fxLossAccountId" },
  { code: "9000", name: "Suspense", type: "asset", system: "suspenseAccountId" },
  { code: "9100", name: "Rounding", type: "expense", system: "roundingAccountId" },
];

const JOURNALS = [
  { code: "GJ", name: "General Journal", type: "general" },
  { code: "SJ", name: "Sales Journal", type: "sales" },
  { code: "PJ", name: "Purchase Journal", type: "purchase" },
  { code: "BJ", name: "Bank Journal", type: "bank" },
  { code: "CJ", name: "Cash Journal", type: "cash" },
  { code: "EJ", name: "Expense Journal", type: "expense" },
  { code: "AJ", name: "Adjustment Journal", type: "adjustment" },
  { code: "OB", name: "Opening Balance Journal", type: "opening" },
];

export async function initializeCompanyAccounting(ctx: ActorContext, companyId: string, opts: { baseCurrency?: string } = {}) {
  assertFinance(ctx, "accounting.manage", companyId);
  if (await prisma.companyAccountingSettings.findUnique({ where: { companyId } })) {
    throw new ServiceError("already_initialized", "Accounting is already set up for this company.", 422);
  }
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) throw new ServiceError("not_found", "Company not found", 404);
  const baseCurrency = (opts.baseCurrency ?? company.baseCurrency ?? "KWD").toUpperCase();

  await prisma.$transaction(async (tx) => {
    // Accounts
    const systemMap: Record<string, string> = {};
    for (const a of CHART) {
      const acct = await tx.account.create({
        data: { companyId, code: a.code, name: a.name, type: a.type, subtype: a.subtype ?? null, normalBalance: normalBalanceFor(a.type), allowPosting: true, isSystem: !!a.system, createdById: ctx.principal.userId },
      });
      if (a.system) systemMap[a.system] = acct.id;
    }
    // Journals
    for (const j of JOURNALS) await tx.journal.create({ data: { companyId, code: j.code, name: j.name, type: j.type, numberPrefix: j.code } });
    // Settings with mapped system accounts
    await tx.companyAccountingSettings.create({
      data: { companyId, baseCurrency, fiscalYearStartMonth: company.fiscalYearStartMonth ?? 1, timezone: company.timezone ?? "Asia/Kuwait", ...systemMap },
    });
  });
  await audit(ctx, { action: "accounting.initialized", entityType: "Company", entityId: companyId, summary: `Chart of accounts + journals (${baseCurrency})`, companyId });
  return { companyId, baseCurrency, accounts: CHART.length, journals: JOURNALS.length };
}
