import { z } from "zod";
import type { Prisma } from "@prisma/client";
import type { Principal } from "@/lib/permissions/engine";
import { prisma } from "@/lib/db";
import { assertCan, audit, type ActorContext } from "@/domain/mutation";
import { ServiceError } from "@/lib/api/handler";
import { optionalString } from "@/lib/validation";
import { D, ZERO, add, sub, mul, roundMoney, gt, isZero } from "@/lib/money";
import { fxResidual } from "@/lib/accounting-math";
import { canFinance, requireSettings } from "./common";
import { resolveExchangeRate } from "./setup";
import { allocateNumber } from "./numbering";
import { prepareForPost, writePostedEntry } from "./posting";

/**
 * BANK, CASH & FX (§Increment E). Bank/cash accounts (each mapped to a GL asset
 * account), transfers between them (same- or cross-currency with realized FX to
 * gain/loss), bank reconciliation against a statement, and the cash-position
 * report. Transfers post through the engine like every other source module.
 */

// ---------------------------------------------------------------------------
// Bank / cash accounts
// ---------------------------------------------------------------------------
export const bankAccountSchema = z.object({
  name: z.string().trim().min(1).max(120),
  type: z.enum(["bank", "cash"]).default("bank"),
  currency: z.string().length(3).default("KWD"),
  glAccountId: z.string().min(1),
  number: optionalString,
  bankName: optionalString,
  iban: optionalString,
  notes: optionalString,
});

export async function listBankAccounts(principal: Principal, companyId: string, includeInactive = false) {
  assertCan(principal, "banks.view", { companyId });
  return prisma.bankAccount.findMany({ where: { companyId, archivedAt: null, ...(includeInactive ? {} : { isActive: true }) }, orderBy: { name: "asc" } });
}

export async function getBankAccount(principal: Principal, id: string) {
  const b = await prisma.bankAccount.findUnique({ where: { id } });
  if (!b) return null;
  if (!canFinance(principal, "banks.view", b.companyId)) throw new ServiceError("forbidden", "Forbidden", 403);
  return b;
}

async function assertGlAccount(companyId: string, accountId: string) {
  const acct = await prisma.account.findUnique({ where: { id: accountId } });
  if (!acct || acct.companyId !== companyId) throw new ServiceError("bad_account", "GL account must belong to this company.", 422);
  if (!acct.allowPosting || !acct.isActive) throw new ServiceError("bad_account", "GL account must be an active postable account.", 422);
}

export async function createBankAccount(ctx: ActorContext, companyId: string, raw: unknown) {
  assertCan(ctx.principal, "banks.manage", { companyId });
  const input = bankAccountSchema.parse(raw);
  await assertGlAccount(companyId, input.glAccountId);
  const b = await prisma.bankAccount.create({
    data: { companyId, name: input.name, type: input.type, currency: input.currency.toUpperCase(), glAccountId: input.glAccountId, number: input.number ?? null, bankName: input.bankName ?? null, iban: input.iban ?? null, notes: input.notes ?? null, createdById: ctx.principal.userId },
  });
  await audit(ctx, { action: "bank_account.created", entityType: "BankAccount", entityId: b.id, summary: `${input.name} (${input.currency})`, companyId });
  return b;
}

export async function updateBankAccount(ctx: ActorContext, id: string, raw: unknown) {
  const b = await prisma.bankAccount.findUnique({ where: { id } });
  if (!b || b.archivedAt) throw new ServiceError("not_found", "Bank account not found", 404);
  assertCan(ctx.principal, "banks.manage", { companyId: b.companyId });
  const input = bankAccountSchema.partial().parse(raw);
  if (input.glAccountId) await assertGlAccount(b.companyId, input.glAccountId);
  const data: Record<string, unknown> = {};
  for (const k of ["name", "type", "glAccountId", "number", "bankName", "iban", "notes"] as const) if (input[k] !== undefined) data[k] = input[k] ?? null;
  if (input.currency !== undefined) data.currency = input.currency.toUpperCase();
  const updated = await prisma.bankAccount.update({ where: { id }, data });
  await audit(ctx, { action: "bank_account.updated", entityType: "BankAccount", entityId: id, summary: updated.name, companyId: b.companyId });
  return updated;
}

export async function setBankAccountActive(ctx: ActorContext, id: string, isActive: boolean) {
  const b = await prisma.bankAccount.findUnique({ where: { id } });
  if (!b || b.archivedAt) throw new ServiceError("not_found", "Bank account not found", 404);
  assertCan(ctx.principal, "banks.manage", { companyId: b.companyId });
  const updated = await prisma.bankAccount.update({ where: { id }, data: { isActive } });
  await audit(ctx, { action: isActive ? "bank_account.activated" : "bank_account.deactivated", entityType: "BankAccount", entityId: id, summary: b.name, companyId: b.companyId });
  return updated;
}

// ---------------------------------------------------------------------------
// Transfers
// ---------------------------------------------------------------------------
export const transferSchema = z.object({
  fromBankAccountId: z.string().min(1),
  toBankAccountId: z.string().min(1),
  date: z.coerce.date(),
  fromAmount: z.coerce.number().positive(),
  toAmount: z.coerce.number().positive().optional(), // defaults to fromAmount when same currency
  reference: optionalString,
  notes: optionalString,
});

export async function listTransfers(principal: Principal, companyId: string) {
  assertCan(principal, "banks.view", { companyId });
  return prisma.bankTransfer.findMany({ where: { companyId }, orderBy: { date: "desc" }, take: 200, include: { fromBankAccount: { select: { name: true } }, toBankAccount: { select: { name: true } } } });
}

/**
 * Post a transfer between two bank/cash accounts. Same currency: Dr destination /
 * Cr source in base. Cross-currency: convert each leg to base at its rate; any base
 * residual posts to FX gain/loss so the entry balances. One atomic posted journal.
 */
export async function createTransfer(ctx: ActorContext, companyId: string, raw: unknown) {
  assertCan(ctx.principal, "banks.manage", { companyId });
  assertCan(ctx.principal, "accounting.post", { companyId });
  const input = transferSchema.parse(raw);
  if (input.fromBankAccountId === input.toBankAccountId) throw new ServiceError("same_account", "Source and destination must differ.", 422);
  const settings = await requireSettings(companyId);
  const base = settings.baseCurrency;
  const [from, to] = await Promise.all([
    prisma.bankAccount.findUnique({ where: { id: input.fromBankAccountId } }),
    prisma.bankAccount.findUnique({ where: { id: input.toBankAccountId } }),
  ]);
  if (!from || from.companyId !== companyId || from.archivedAt) throw new ServiceError("bad_account", "Source account not found.", 422);
  if (!to || to.companyId !== companyId || to.archivedAt) throw new ServiceError("bad_account", "Destination account not found.", 422);
  if (!from.glAccountId || !to.glAccountId) throw new ServiceError("no_gl", "Both accounts must be mapped to a GL account.", 422);

  const fromAmount = roundMoney(input.fromAmount, from.currency);
  const toAmount = roundMoney(input.toAmount ?? (from.currency === to.currency ? input.fromAmount : input.fromAmount), to.currency);
  const fromRate = from.currency === base ? 1 : await resolveExchangeRate(from.currency, base, input.date);
  const toRate = to.currency === base ? 1 : await resolveExchangeRate(to.currency, base, input.date);
  const fromBase = roundMoney(mul(fromAmount, fromRate), base, settings.roundingPolicy as never);
  const toBase = roundMoney(mul(toAmount, toRate), base, settings.roundingPolicy as never);
  const residual = fxResidual(fromBase, toBase); // loss = source cost exceeds destination value

  // Build a base-currency journal: Dr destination(base) / Cr source(base) + FX plug.
  const lines: Record<string, unknown>[] = [
    { accountId: to.glAccountId, debit: Number(toBase), credit: 0, description: `Transfer in — ${to.name}` },
    { accountId: from.glAccountId, debit: 0, credit: Number(fromBase), description: `Transfer out — ${from.name}` },
  ];
  if (residual.kind !== "none") {
    const fxAccountId = residual.kind === "loss" ? settings.fxLossAccountId : settings.fxGainAccountId;
    if (!fxAccountId) throw new ServiceError("no_fx_account", "Cross-currency transfer needs FX gain/loss accounts configured.", 422);
    if (residual.kind === "loss") lines.push({ accountId: fxAccountId, debit: Number(residual.amount), credit: 0, description: "FX loss on transfer" });
    else lines.push({ accountId: fxAccountId, debit: 0, credit: Number(residual.amount), description: "FX gain on transfer" });
  }

  const journalRaw = { companyId, journalCode: "BJ", date: input.date, currency: base, reference: input.reference ?? undefined, memo: `Transfer ${from.name} → ${to.name}`, sourceType: "BankTransfer", sourceId: "pending", lines };
  const { input: jInput, prepared, postingDate, periodId } = await prepareForPost(ctx, journalRaw);

  const transfer = await prisma.$transaction(async (tx) => {
    const number = await allocateNumber(tx, { companyId, key: "transfer", prefix: "TRF", year: input.date.getFullYear() });
    const t = await tx.bankTransfer.create({
      data: {
        companyId, transferNumber: number, fromBankAccountId: from.id, toBankAccountId: to.id, date: input.date,
        fromCurrency: from.currency, toCurrency: to.currency, fromAmount, toAmount,
        exchangeRate: from.currency === to.currency ? D(1) : D(Number(toAmount) / Number(fromAmount)),
        baseCurrency: base, reference: input.reference ?? null, notes: input.notes ?? null, createdById: ctx.principal.userId, postedById: ctx.principal.userId, postedAt: new Date(),
      },
    });
    const entry = await writePostedEntry(tx, ctx, { ...jInput, sourceId: t.id }, prepared, postingDate, periodId);
    return tx.bankTransfer.update({ where: { id: t.id }, data: { journalEntryId: entry.id } });
  });
  await audit(ctx, { action: "transfer.posted", entityType: "BankTransfer", entityId: transfer.id, summary: `${transfer.transferNumber} ${from.name}→${to.name} ${fromAmount} ${from.currency}`, companyId });
  return transfer;
}

// ---------------------------------------------------------------------------
// Cash position
// ---------------------------------------------------------------------------
/** Book balance per bank/cash account, from posted GL lines on its mapped account. */
export async function cashPosition(principal: Principal, companyId: string, asOf: Date = new Date()) {
  assertCan(principal, "banks.view", { companyId });
  const accounts = await prisma.bankAccount.findMany({ where: { companyId, archivedAt: null }, orderBy: { name: "asc" } });
  const glIds = accounts.map((a) => a.glAccountId).filter((x): x is string => !!x);
  const grouped = glIds.length ? await prisma.journalLine.groupBy({ by: ["accountId"], where: { companyId, accountId: { in: glIds }, entry: { status: "posted", postingDate: { lte: asOf } } }, _sum: { debit: true, credit: true } }) : [];
  const byAccount = new Map(grouped.map((g) => [g.accountId, sub(D(g._sum.debit ?? 0), D(g._sum.credit ?? 0))]));
  const rows = accounts.map((a) => ({ id: a.id, name: a.name, type: a.type, currency: a.currency, glAccountId: a.glAccountId, balance: a.glAccountId ? byAccount.get(a.glAccountId) ?? ZERO : ZERO }));
  const baseTotal = rows.reduce((s, r) => add(s, r.balance), ZERO); // GL balances are already base-currency
  return { asOf, rows, baseTotal };
}

// ---------------------------------------------------------------------------
// Reconciliation
// ---------------------------------------------------------------------------
export const reconciliationSchema = z.object({
  bankAccountId: z.string().min(1),
  statementDate: z.coerce.date(),
  statementBalance: z.coerce.number(),
  note: optionalString,
});

export async function listReconciliations(principal: Principal, companyId: string) {
  assertCan(principal, "banks.view", { companyId });
  return prisma.bankReconciliation.findMany({ where: { companyId }, orderBy: { statementDate: "desc" }, take: 100, include: { bankAccount: { select: { name: true } } } });
}

export async function createReconciliation(ctx: ActorContext, companyId: string, raw: unknown) {
  assertCan(ctx.principal, "banks.manage", { companyId });
  const input = reconciliationSchema.parse(raw);
  const bank = await prisma.bankAccount.findUnique({ where: { id: input.bankAccountId } });
  if (!bank || bank.companyId !== companyId) throw new ServiceError("bad_account", "Bank account not found.", 422);
  const rec = await prisma.bankReconciliation.create({ data: { companyId, bankAccountId: bank.id, statementDate: input.statementDate, statementBalance: input.statementBalance, note: input.note ?? null, createdById: ctx.principal.userId } });
  await audit(ctx, { action: "reconciliation.created", entityType: "BankReconciliation", entityId: rec.id, summary: `${bank.name} @ ${input.statementDate.toISOString().slice(0, 10)}`, companyId });
  return rec;
}

/** Reconciliation with the bank's GL lines (unreconciled, or already cleared to this session). */
export async function getReconciliation(principal: Principal, id: string) {
  const rec = await prisma.bankReconciliation.findUnique({ where: { id }, include: { bankAccount: true } });
  if (!rec) return null;
  if (!canFinance(principal, "banks.view", rec.companyId)) throw new ServiceError("forbidden", "Forbidden", 403);
  const glAccountId = rec.bankAccount.glAccountId;
  const lines = glAccountId ? await prisma.journalLine.findMany({
    where: { companyId: rec.companyId, accountId: glAccountId, entry: { status: "posted", postingDate: { lte: rec.statementDate } }, OR: [{ reconciliationId: null }, { reconciliationId: id }] },
    include: { entry: { select: { journalNumber: true, postingDate: true, memo: true } } },
    orderBy: { entry: { postingDate: "asc" } },
  }) : [];
  return { rec, lines };
}

export async function setLineReconciled(ctx: ActorContext, reconciliationId: string, journalLineId: string, cleared: boolean) {
  const rec = await prisma.bankReconciliation.findUnique({ where: { id: reconciliationId }, include: { bankAccount: true } });
  if (!rec) throw new ServiceError("not_found", "Reconciliation not found", 404);
  assertCan(ctx.principal, "banks.manage", { companyId: rec.companyId });
  if (rec.status === "completed") throw new ServiceError("completed", "Reconciliation is completed.", 422);
  const line = await prisma.journalLine.findUnique({ where: { id: journalLineId } });
  if (!line || line.companyId !== rec.companyId || line.accountId !== rec.bankAccount.glAccountId) throw new ServiceError("bad_line", "Line does not belong to this bank account.", 422);
  if (cleared && line.reconciliationId && line.reconciliationId !== reconciliationId) throw new ServiceError("already_cleared", "Line is cleared on another reconciliation.", 422);
  await prisma.journalLine.update({ where: { id: journalLineId }, data: { reconciliationId: cleared ? reconciliationId : null, reconciledAt: cleared ? new Date() : null } });
  // Recompute cleared balance = sum(debit - credit) of lines cleared to this rec.
  const g = await prisma.journalLine.groupBy({ by: ["reconciliationId"], where: { reconciliationId }, _sum: { debit: true, credit: true } });
  const clearedBalance = g[0] ? sub(D(g[0]._sum.debit ?? 0), D(g[0]._sum.credit ?? 0)) : ZERO;
  await prisma.bankReconciliation.update({ where: { id: reconciliationId }, data: { clearedBalance } });
  return { clearedBalance: clearedBalance.toString() };
}

export async function completeReconciliation(ctx: ActorContext, id: string, opts: { force?: boolean } = {}) {
  const rec = await prisma.bankReconciliation.findUnique({ where: { id } });
  if (!rec) throw new ServiceError("not_found", "Reconciliation not found", 404);
  assertCan(ctx.principal, "banks.manage", { companyId: rec.companyId });
  if (rec.status === "completed") throw new ServiceError("completed", "Already completed.", 422);
  const diff = sub(rec.statementBalance, rec.clearedBalance);
  if (!isZero(diff) && !opts.force) throw new ServiceError("unbalanced", `Cleared balance (${rec.clearedBalance}) does not match the statement (${rec.statementBalance}); difference ${diff}.`, 422);
  const updated = await prisma.bankReconciliation.update({ where: { id }, data: { status: "completed", completedById: ctx.principal.userId, completedAt: new Date() } });
  await audit(ctx, { action: "reconciliation.completed", entityType: "BankReconciliation", entityId: id, summary: `cleared ${rec.clearedBalance}${opts.force && !isZero(diff) ? ` (forced, diff ${diff})` : ""}`, companyId: rec.companyId });
  return updated;
}
