import { z } from "zod";
import type { JournalEntry, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { assertCan, audit, type ActorContext } from "@/domain/mutation";
import { ServiceError } from "@/lib/api/handler";
import { optionalString } from "@/lib/validation";
import { D, ZERO, add, mul, roundMoney, balances, isNeg, gt, isZero } from "@/lib/money";
import { canFinance, requireSettings } from "./common";
import { assertOpenPeriod } from "./fiscal";
import { resolveExchangeRate } from "./setup";
import { allocateNumber } from "./numbering";

/**
 * THE POSTING ENGINE (§10–14, §74) — the single path every accounting source
 * module posts through. Individual modules never insert posted JournalLine rows
 * directly. It performs, atomically: authorization, schema + company + account +
 * period + balance validation, FX resolution, concurrency-safe numbering, the
 * transactional write, the immutable status transition, and audit.
 *
 * Posted entries are immutable (§3): correction is by reversal/adjustment, never
 * by editing a posted entry back to draft.
 */

export const lineSchema = z.object({
  accountId: z.string().min(1),
  description: optionalString,
  debit: z.coerce.number().min(0).default(0),
  credit: z.coerce.number().min(0).default(0),
  brandId: optionalString,
  countryId: optionalString,
  departmentId: optionalString,
  campaignId: optionalString,
  storeId: optionalString,
  productId: optionalString,
  costCenterId: optionalString,
  customerId: optionalString,
  supplierId: optionalString,
});

export const journalInputSchema = z.object({
  companyId: z.string().min(1),
  journalCode: optionalString, // resolves to a Journal; defaults to GJ
  date: z.coerce.date(),
  postingDate: z.preprocess((v) => (v ? new Date(v as string) : undefined), z.date().optional()),
  documentDate: z.preprocess((v) => (v ? new Date(v as string) : undefined), z.date().optional()),
  reference: optionalString,
  memo: optionalString,
  currency: optionalString, // entry transaction currency; defaults to base
  exchangeRate: z.coerce.number().positive().optional(),
  sourceType: optionalString,
  sourceId: optionalString,
  lines: z.array(lineSchema).min(2),
});
export type JournalInput = z.infer<typeof journalInputSchema>;

interface PreparedLine {
  accountId: string; description: string | null;
  debit: Prisma.Decimal; credit: Prisma.Decimal; // BASE amounts
  transactionCurrency: string; transactionAmount: Prisma.Decimal; exchangeRate: Prisma.Decimal;
  dims: Record<string, string | null>;
}

/**
 * Validate + prepare a journal for posting: resolves accounts, FX, base amounts,
 * and asserts balance. Returns the prepared lines + totals. Shared by draft
 * validation and posting. Throws ServiceError on any violation.
 */
async function prepare(input: JournalInput): Promise<{ baseCurrency: string; currency: string; rate: number; lines: PreparedLine[]; totalDebit: Prisma.Decimal; totalCredit: Prisma.Decimal }> {
  const settings = await requireSettings(input.companyId);
  const baseCurrency = settings.baseCurrency;
  const currency = (input.currency ?? baseCurrency).toUpperCase();
  const postingDate = input.postingDate ?? input.date;
  const rate = currency === baseCurrency ? 1 : (input.exchangeRate ?? (await resolveExchangeRate(currency, baseCurrency, postingDate)));

  // Load all referenced accounts once; validate company + posting eligibility.
  const accountIds = [...new Set(input.lines.map((l) => l.accountId))];
  const accounts = await prisma.account.findMany({ where: { id: { in: accountIds } } });
  const byId = new Map(accounts.map((a) => [a.id, a]));

  const prepared: PreparedLine[] = [];
  let totalDebit = ZERO, totalCredit = ZERO;
  let txnDebit = ZERO, txnCredit = ZERO;

  for (const l of input.lines) {
    const acct = byId.get(l.accountId);
    if (!acct) throw new ServiceError("bad_account", `Account ${l.accountId} not found.`, 422);
    if (acct.companyId !== input.companyId) throw new ServiceError("cross_company", "A journal cannot mix accounts from different legal companies (§3).", 422);
    if (acct.archivedAt || !acct.isActive) throw new ServiceError("inactive_account", `Account ${acct.code} is not active.`, 422);
    if (!acct.allowPosting) throw new ServiceError("no_direct_posting", `Account ${acct.code} is a header account and cannot be posted to directly.`, 422);
    if (isNeg(l.debit) || isNeg(l.credit)) throw new ServiceError("negative", "Debit and credit must be ≥ 0.", 422);
    const hasDebit = gt(l.debit, 0), hasCredit = gt(l.credit, 0);
    if (hasDebit && hasCredit) throw new ServiceError("both_sides", "A line cannot have both a debit and a credit.", 422);
    if (!hasDebit && !hasCredit) throw new ServiceError("empty_line", "Each line must have a debit or a credit amount.", 422);

    const txnAmt = hasDebit ? D(l.debit) : D(l.credit);
    txnDebit = add(txnDebit, l.debit); txnCredit = add(txnCredit, l.credit);
    const baseDebit = hasDebit ? roundMoney(mul(l.debit, rate), baseCurrency, settings.roundingPolicy as never) : ZERO;
    const baseCredit = hasCredit ? roundMoney(mul(l.credit, rate), baseCurrency, settings.roundingPolicy as never) : ZERO;
    totalDebit = add(totalDebit, baseDebit); totalCredit = add(totalCredit, baseCredit);

    prepared.push({
      accountId: l.accountId, description: l.description ?? null, debit: baseDebit, credit: baseCredit,
      transactionCurrency: currency, transactionAmount: txnAmt, exchangeRate: D(rate),
      dims: { brandId: l.brandId ?? null, countryId: l.countryId ?? null, departmentId: l.departmentId ?? null, campaignId: l.campaignId ?? null, storeId: l.storeId ?? null, productId: l.productId ?? null, costCenterId: l.costCenterId ?? null, customerId: l.customerId ?? null, supplierId: l.supplierId ?? null },
    });
  }

  // Transaction currency must balance exactly; base within rounding tolerance.
  if (!txnDebit.equals(txnCredit)) throw new ServiceError("unbalanced", `Debits (${txnDebit}) and credits (${txnCredit}) must be equal.`, 422);
  if (!balances(totalDebit, totalCredit, baseCurrency)) throw new ServiceError("unbalanced_base", `Base-currency debits (${totalDebit}) and credits (${totalCredit}) do not balance.`, 422);

  return { baseCurrency, currency, rate, lines: prepared, totalDebit, totalCredit };
}

/** Validate a would-be journal without posting (for the builder's live check). */
export async function validateJournal(principal: import("@/lib/permissions/engine").Principal, raw: unknown): Promise<{ ok: boolean; error?: string; totalDebit?: string; totalCredit?: string }> {
  const input = journalInputSchema.parse(raw);
  if (!canFinance(principal, "accounting.view", input.companyId)) return { ok: false, error: "forbidden" };
  try {
    const p = await prepare(input);
    return { ok: true, totalDebit: p.totalDebit.toString(), totalCredit: p.totalCredit.toString() };
  } catch (e) {
    return { ok: false, error: e instanceof ServiceError ? e.message : "invalid" };
  }
}

async function resolveJournalId(tx: Prisma.TransactionClient, companyId: string, code: string | null | undefined): Promise<{ id: string | null; prefix: string }> {
  const journal = await tx.journal.findFirst({ where: { companyId, ...(code ? { code } : { type: "general" }) } });
  return { id: journal?.id ?? null, prefix: journal?.numberPrefix ?? journal?.code ?? "GJ" };
}

/**
 * Authorize + validate + resolve the posting period for a journal, without
 * writing. Returns the parsed input, prepared lines and the open period id. Shared
 * by `postJournalEntry` and source modules (AR/AP/…) that post inside their own
 * transaction via {@link writePostedEntry}.
 */
export async function prepareForPost(ctx: ActorContext, raw: unknown): Promise<{ input: JournalInput; prepared: Awaited<ReturnType<typeof prepare>>; postingDate: Date; periodId: string | null }> {
  const input = journalInputSchema.parse(raw);
  assertCan(ctx.principal, "accounting.post", { companyId: input.companyId });
  const prepared = await prepare(input);
  const postingDate = input.postingDate ?? input.date;
  const elevated = canFinance(ctx.principal, "periods.manage", input.companyId);
  const periodId = await assertOpenPeriod(input.companyId, postingDate, elevated);
  return { input, prepared, postingDate, periodId };
}

/**
 * Write a posted entry + its lines inside an existing transaction (concurrency-safe
 * numbering, immutable `posted` status). The single write path — source modules
 * call this so their sub-ledger update and the GL post commit atomically. The
 * caller is responsible for the audit entry (so it reflects the source document).
 */
export async function writePostedEntry(tx: Prisma.TransactionClient, ctx: ActorContext, input: JournalInput, prepared: Awaited<ReturnType<typeof prepare>>, postingDate: Date, periodId: string | null): Promise<JournalEntry> {
  const { id: journalId, prefix } = await resolveJournalId(tx, input.companyId, input.journalCode);
  const number = await allocateNumber(tx, { companyId: input.companyId, key: `journal:${prefix}`, prefix, year: postingDate.getFullYear() });
  const e = await tx.journalEntry.create({
    data: {
      companyId: input.companyId, journalId, journalNumber: number, periodId,
      date: input.date, postingDate, documentDate: input.documentDate ?? null,
      reference: input.reference ?? null, memo: input.memo ?? null,
      status: "posted", currency: prepared.currency, baseCurrency: prepared.baseCurrency, exchangeRate: D(prepared.rate),
      totalDebitBase: prepared.totalDebit, totalCreditBase: prepared.totalCredit,
      sourceType: input.sourceType ?? "ManualJournal", sourceId: input.sourceId ?? null,
      createdById: ctx.principal.userId, postedById: ctx.principal.userId, postedAt: new Date(),
    },
  });
  await tx.journalLine.createMany({
    data: prepared.lines.map((l, i) => ({
      entryId: e.id, accountId: l.accountId, lineNo: i + 1, description: l.description,
      debit: l.debit, credit: l.credit, transactionCurrency: l.transactionCurrency, transactionAmount: l.transactionAmount, exchangeRate: l.exchangeRate,
      companyId: input.companyId, ...l.dims,
    })),
  });
  return e;
}

/**
 * Post a balanced journal entry to the ledger. Concurrency-safe numbering + the
 * whole write run in one transaction (§74/§75): a double-click cannot create two
 * entries with the same number, and any failure rolls the whole thing back.
 */
export async function postJournalEntry(ctx: ActorContext, raw: unknown): Promise<JournalEntry> {
  const { input, prepared, postingDate, periodId } = await prepareForPost(ctx, raw);
  const entry = await prisma.$transaction((tx) => writePostedEntry(tx, ctx, input, prepared, postingDate, periodId));
  await audit(ctx, { action: "journal.posted", entityType: "JournalEntry", entityId: entry.id, summary: `${entry.journalNumber} ${prepared.totalDebit} ${prepared.baseCurrency}`, companyId: input.companyId });
  return entry;
}

/**
 * Reverse a posted entry (§14): creates a new entry with debit/credit swapped,
 * links both reciprocally. Requires accounting.reverse. The reversal's posting date
 * must be in an open period.
 */
export async function reverseEntry(ctx: ActorContext, entryId: string, opts: { date?: Date; reason: string }): Promise<JournalEntry> {
  const original = await prisma.journalEntry.findUnique({ where: { id: entryId }, include: { lines: true } });
  if (!original) throw new ServiceError("not_found", "Entry not found", 404);
  assertCan(ctx.principal, "accounting.reverse", { companyId: original.companyId });
  if (original.status !== "posted") throw new ServiceError("not_posted", "Only a posted entry can be reversed.", 422);
  if (original.reversedByEntryId) throw new ServiceError("already_reversed", "This entry has already been reversed.", 422);
  if (!opts.reason?.trim()) throw new ServiceError("reason_required", "A reversal reason is required.", 422);
  const postingDate = opts.date ?? new Date();
  const elevated = canFinance(ctx.principal, "periods.manage", original.companyId);
  const periodId = await assertOpenPeriod(original.companyId, postingDate, elevated);

  const reversal = await prisma.$transaction(async (tx) => {
    const prefix = "REV";
    const number = await allocateNumber(tx, { companyId: original.companyId, key: `journal:${prefix}`, prefix, year: postingDate.getFullYear() });
    const rev = await tx.journalEntry.create({
      data: {
        companyId: original.companyId, journalId: original.journalId, journalNumber: number, periodId,
        date: postingDate, postingDate, reference: original.reference, memo: `Reversal of ${original.journalNumber}: ${opts.reason}`,
        status: "posted", currency: original.currency, baseCurrency: original.baseCurrency, exchangeRate: original.exchangeRate,
        totalDebitBase: original.totalCreditBase, totalCreditBase: original.totalDebitBase,
        sourceType: "Reversal", sourceId: original.id, reversalOfEntryId: original.id,
        createdById: ctx.principal.userId, postedById: ctx.principal.userId, postedAt: new Date(),
      },
    });
    await tx.journalLine.createMany({
      data: original.lines.map((l, i) => ({
        entryId: rev.id, accountId: l.accountId, lineNo: i + 1, description: `Reversal: ${l.description ?? ""}`.trim(),
        debit: l.credit, credit: l.debit, transactionCurrency: l.transactionCurrency, transactionAmount: l.transactionAmount, exchangeRate: l.exchangeRate,
        companyId: original.companyId, brandId: l.brandId, countryId: l.countryId, departmentId: l.departmentId, campaignId: l.campaignId, storeId: l.storeId, productId: l.productId, costCenterId: l.costCenterId, customerId: l.customerId, supplierId: l.supplierId,
      })),
    });
    await tx.journalEntry.update({ where: { id: original.id }, data: { status: "reversed", reversedByEntryId: rev.id } });
    return rev;
  });
  await audit(ctx, { action: "journal.reversed", entityType: "JournalEntry", entityId: original.id, summary: `${original.journalNumber} reversed by ${reversal.journalNumber}: ${opts.reason}`, companyId: original.companyId });
  return reversal;
}

/** Read a journal entry with lines (scope-guarded). */
export async function getJournalEntry(principal: import("@/lib/permissions/engine").Principal, id: string) {
  const entry = await prisma.journalEntry.findUnique({ where: { id }, include: { lines: { orderBy: { lineNo: "asc" } } } });
  if (!entry) return null;
  if (!canFinance(principal, "accounting.view", entry.companyId)) throw new ServiceError("forbidden", "Forbidden", 403);
  return entry;
}

export { isZero };
