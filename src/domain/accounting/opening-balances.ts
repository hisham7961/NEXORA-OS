import { z } from "zod";
import type { Principal } from "@/lib/permissions/engine";
import { prisma } from "@/lib/db";
import { assertCan, type ActorContext } from "@/domain/mutation";
import { ServiceError } from "@/lib/api/handler";
import { requireSettings } from "./common";
import { postJournalEntry } from "./posting";
import { D, add, sub, roundMoney } from "@/lib/money";

/**
 * Opening balances (§group-rollout / go-live). When a company starts using NEXORA
 * mid-life, its existing account balances must be carried in as a single balanced
 * opening journal before any live posting. The operator enters a debit or credit per
 * account; the residual is posted to a chosen Opening Balance Equity account so the
 * entry always balances. It posts through the same audited posting engine (dated at
 * go-live) and can only be done once per company — a guard prevents a second opening
 * entry silently doubling balances.
 */
export const SOURCE_TYPE = "OpeningBalance";

export const openingBalanceSchema = z.object({
  asOfDate: z.coerce.date(),
  equityAccountId: z.string().min(1),
  lines: z.array(z.object({
    accountId: z.string().min(1),
    debit: z.coerce.number().min(0).default(0),
    credit: z.coerce.number().min(0).default(0),
  })).min(1),
});

/** Whether this company already has a posted opening-balance entry. */
export async function openingBalancesStatus(principal: Principal, companyId: string): Promise<{ posted: boolean; entryId: string | null; postedAt: Date | null }> {
  const existing = await prisma.journalEntry.findFirst({
    where: { companyId, sourceType: SOURCE_TYPE, status: "posted" },
    orderBy: { postedAt: "desc" }, select: { id: true, postedAt: true },
  });
  return { posted: !!existing, entryId: existing?.id ?? null, postedAt: existing?.postedAt ?? null };
}

/** Postable accounts for entering opening balances (system + user, excluding non-postable parents). */
export async function listOpeningAccounts(principal: Principal, companyId: string) {
  await requireSettings(companyId); // ensures accounting is initialized
  return prisma.account.findMany({
    where: { companyId, archivedAt: null, allowPosting: true },
    orderBy: { code: "asc" },
    select: { id: true, code: true, name: true, type: true },
  });
}

/**
 * Post the opening-balance journal. Validates each line has only one side, that at
 * least one non-zero amount was entered, and balances the residual to the chosen
 * equity account. Rejects a second opening entry.
 */
export async function postOpeningBalances(ctx: ActorContext, companyId: string, raw: unknown) {
  assertCan(ctx.principal, "accounting.post", { companyId });
  const input = openingBalanceSchema.parse(raw);
  const settings = await requireSettings(companyId);

  const status = await openingBalancesStatus(ctx.principal, companyId);
  if (status.posted) throw new ServiceError("already_posted", "Opening balances have already been posted for this company. Reverse the existing opening entry to redo them.", 409);

  // Validate lines: one side each, at least one non-zero.
  let totalDebit = D(0), totalCredit = D(0);
  const lines: { accountId: string; debit: number; credit: number; description: string }[] = [];
  for (const l of input.lines) {
    if (l.debit > 0 && l.credit > 0) throw new ServiceError("bad_line", "Each account takes a debit OR a credit, not both.", 422);
    if (l.debit === 0 && l.credit === 0) continue; // skip untouched accounts
    if (l.accountId === input.equityAccountId) throw new ServiceError("bad_line", "The opening-equity account balances the entry automatically; don't give it a line.", 422);
    totalDebit = add(totalDebit, D(l.debit));
    totalCredit = add(totalCredit, D(l.credit));
    lines.push({ accountId: l.accountId, debit: l.debit, credit: l.credit, description: "Opening balance" });
  }
  if (lines.length === 0) throw new ServiceError("empty", "Enter at least one opening balance.", 422);

  // Balance the residual to the equity account.
  const residual = roundMoney(sub(totalDebit, totalCredit), settings.baseCurrency);
  if (!residual.isZero()) {
    const amt = Number(residual.abs());
    lines.push(residual.isPositive()
      ? { accountId: input.equityAccountId, debit: 0, credit: amt, description: "Opening balance equity" }
      : { accountId: input.equityAccountId, debit: amt, credit: 0, description: "Opening balance equity" });
  } else if (lines.length < 2) {
    throw new ServiceError("unbalanced", "A single balanced line cannot post on its own.", 422);
  }

  return postJournalEntry(ctx, {
    companyId,
    journalCode: "OB",
    date: input.asOfDate,
    reference: "Opening balances",
    memo: `Opening balances as of ${input.asOfDate.toISOString().slice(0, 10)}`,
    sourceType: SOURCE_TYPE,
    lines,
  });
}
