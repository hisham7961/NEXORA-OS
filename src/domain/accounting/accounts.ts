import { z } from "zod";
import type { Account } from "@prisma/client";
import type { Principal } from "@/lib/permissions/engine";
import { prisma } from "@/lib/db";
import { assertCan, audit, type ActorContext } from "@/domain/mutation";
import { ServiceError } from "@/lib/api/handler";
import { optionalString } from "@/lib/validation";
import { assertFinance } from "./common";

/**
 * Chart of Accounts (§5/§6). Hierarchical, per legal company. Accounts with ledger
 * history can never be deleted (only deactivated). `normalBalance` is derived from
 * type. System-mapped accounts are protected. `allowPosting=false` marks a
 * header/summary account that journals cannot post to directly.
 */
export const ACCOUNT_TYPES = ["asset", "liability", "equity", "revenue", "cogs", "expense", "other_income", "other_expense"] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

/** The normal (increasing) balance side for a type. */
export function normalBalanceFor(type: string): "debit" | "credit" {
  return type === "asset" || type === "cogs" || type === "expense" || type === "other_expense" ? "debit" : "credit";
}

export const accountSchema = z.object({
  code: z.string().trim().min(1).max(20),
  name: z.string().trim().min(1).max(160),
  nameLocalized: optionalString,
  type: z.enum(ACCOUNT_TYPES),
  subtype: optionalString,
  parentId: optionalString,
  currency: optionalString,
  allowPosting: z.preprocess((v) => (v === undefined ? undefined : v === true || v === "true" || v === "on"), z.boolean().optional()),
  notes: optionalString,
});

export async function listChartOfAccounts(principal: Principal, companyId: string, opts: { includeInactive?: boolean } = {}) {
  assertCan(principal, "accounts.view", { companyId });
  return prisma.account.findMany({
    where: { companyId, archivedAt: null, ...(opts.includeInactive ? {} : { isActive: true }) },
    orderBy: { code: "asc" },
  });
}

export async function getAccount(principal: Principal, id: string) {
  const a = await prisma.account.findUnique({ where: { id } });
  if (!a || a.archivedAt) return null;
  assertCan(principal, "accounts.view", { companyId: a.companyId });
  return a;
}

export async function createAccount(ctx: ActorContext, companyId: string, raw: unknown): Promise<Account> {
  assertFinance(ctx, "accounts.manage", companyId);
  const input = accountSchema.parse(raw);
  if (await prisma.account.findUnique({ where: { companyId_code: { companyId, code: input.code } } })) {
    throw new ServiceError("code_taken", `Account code "${input.code}" already exists for this company.`, 422);
  }
  let level = 0;
  if (input.parentId) {
    const parent = await prisma.account.findUnique({ where: { id: input.parentId } });
    if (!parent || parent.companyId !== companyId) throw new ServiceError("bad_parent", "Parent account must belong to this company.", 422);
    level = parent.level + 1;
    // A parent with posting history/children becomes a header account.
    if (parent.allowPosting) await prisma.account.update({ where: { id: parent.id }, data: { allowPosting: false } });
  }
  const account = await prisma.account.create({
    data: {
      companyId, code: input.code, name: input.name, nameLocalized: input.nameLocalized ?? null,
      type: input.type, subtype: input.subtype ?? null, parentId: input.parentId ?? null, level,
      normalBalance: normalBalanceFor(input.type), currency: input.currency ?? null,
      allowPosting: input.allowPosting ?? true, notes: input.notes ?? null, createdById: ctx.principal.userId,
    },
  });
  await audit(ctx, { action: "account.created", entityType: "Account", entityId: account.id, summary: `${input.code} ${input.name}`, companyId });
  return account;
}

async function loadEditable(ctx: ActorContext, id: string): Promise<Account> {
  const a = await prisma.account.findUnique({ where: { id } });
  if (!a || a.archivedAt) throw new ServiceError("not_found", "Account not found", 404);
  assertFinance(ctx, "accounts.manage", a.companyId);
  return a;
}

export async function updateAccount(ctx: ActorContext, id: string, raw: unknown): Promise<Account> {
  const a = await loadEditable(ctx, id);
  const input = accountSchema.partial().parse(raw);
  if (input.code && input.code !== a.code && (await prisma.account.findUnique({ where: { companyId_code: { companyId: a.companyId, code: input.code } } }))) {
    throw new ServiceError("code_taken", "Account code already exists.", 422);
  }
  // Changing the type of an account with ledger history is unsafe.
  if (input.type && input.type !== a.type) {
    const used = await prisma.journalLine.count({ where: { accountId: id } });
    if (used > 0) throw new ServiceError("type_locked", "Cannot change the type of an account with ledger history.", 422);
  }
  const data: Record<string, unknown> = {};
  for (const k of ["code", "name", "nameLocalized", "subtype", "currency", "notes"] as const) if (input[k] !== undefined) data[k] = input[k] ?? null;
  if (input.type) { data.type = input.type; data.normalBalance = normalBalanceFor(input.type); }
  if (input.allowPosting !== undefined) data.allowPosting = input.allowPosting;
  const account = await prisma.account.update({ where: { id }, data });
  await audit(ctx, { action: "account.updated", entityType: "Account", entityId: id, summary: `${account.code} ${account.name}`, companyId: a.companyId });
  return account;
}

/** Deactivate (never delete an account with ledger history, §5). */
export async function setAccountActive(ctx: ActorContext, id: string, isActive: boolean): Promise<void> {
  const a = await loadEditable(ctx, id);
  if (!isActive && a.isSystem) throw new ServiceError("system_protected", "This account is mapped in accounting settings and cannot be deactivated.", 422);
  await prisma.account.update({ where: { id }, data: { isActive } });
  await audit(ctx, { action: isActive ? "account.activated" : "account.deactivated", entityType: "Account", entityId: id, summary: `${a.code}`, companyId: a.companyId });
}

export async function archiveAccount(ctx: ActorContext, id: string): Promise<void> {
  const a = await loadEditable(ctx, id);
  if (a.isSystem) throw new ServiceError("system_protected", "A system-mapped account cannot be deleted.", 422);
  const used = await prisma.journalLine.count({ where: { accountId: id } });
  if (used > 0) throw new ServiceError("has_history", "Cannot delete an account with ledger history — deactivate it instead.", 422);
  await prisma.account.update({ where: { id }, data: { archivedAt: new Date(), isActive: false } });
  await audit(ctx, { action: "account.archived", entityType: "Account", entityId: id, summary: a.code, companyId: a.companyId });
}
