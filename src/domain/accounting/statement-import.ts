import { z } from "zod";
import type { Prisma } from "@prisma/client";
import type { Principal } from "@/lib/permissions/engine";
import { prisma } from "@/lib/db";
import { assertCan, audit, type ActorContext } from "@/domain/mutation";
import { ServiceError } from "@/lib/api/handler";
import { optionalString } from "@/lib/validation";
import { D, ZERO, add, sub, roundMoney } from "@/lib/money";
import { parseCsvObjects } from "@/lib/csv";
import { canFinance } from "./common";
import { createHash } from "crypto";

/**
 * Bank statement import + reconciliation matching (§Phase4-4/5). Statement lines are
 * NEVER posted to the GL — they are matched to existing posted ledger lines during a
 * reconciliation. Import: upload CSV → map columns → validate → preview (with
 * duplicate detection) → confirm → store. Matching: suggest statement-line ↔ GL-line
 * pairs by amount/date/reference; a suggestion only clears a line on explicit confirm.
 */

export const columnMapping = z.object({
  date: z.string().min(1),
  description: z.string().min(1),
  reference: optionalString,
  valueDate: optionalString,
  amount: optionalString, // signed column (+ inflow); OR use debit/credit
  debit: optionalString, // money out of the account
  credit: optionalString, // money into the account
  balance: optionalString,
  currency: optionalString,
});
export type ColumnMapping = z.infer<typeof columnMapping>;

/** Lenient date parse: ISO, yyyy-mm-dd, dd/mm/yyyy, dd-mm-yyyy, mm/dd/yyyy heuristics. */
function parseDate(raw: string): Date | null {
  const s = raw.trim();
  if (!s) return null;
  const iso = /^\d{4}-\d{2}-\d{2}/.exec(s);
  if (iso) { const d = new Date(s); return isNaN(d.getTime()) ? null : d; }
  const m = /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/.exec(s);
  if (m) {
    let [, a, b, y] = m;
    const yr = y.length === 2 ? 2000 + Number(y) : Number(y);
    let day = Number(a), mon = Number(b);
    if (day > 12 && mon <= 12) { /* dd/mm */ } else if (mon > 12 && day <= 12) { [day, mon] = [mon, day]; }
    const d = new Date(yr, mon - 1, day);
    return isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function parseAmount(raw: string | undefined): Prisma.Decimal | null {
  if (raw == null) return null;
  const s = raw.replace(/[,\s]/g, "").replace(/[()]/g, (m) => (m === "(" ? "-" : ""));
  if (s === "" || s === "-") return null;
  try { return D(s); } catch { return null; }
}

interface ParsedRow { index: number; txnDate: Date | null; valueDate: Date | null; description: string; reference: string | null; amount: Prisma.Decimal | null; runningBalance: Prisma.Decimal | null; currency: string | null; issues: string[]; dedupeKey: string; duplicate: boolean; }

async function parseRows(companyId: string, bankAccountId: string, csvText: string, mapping: ColumnMapping): Promise<ParsedRow[]> {
  const { headers, rows } = parseCsvObjects(csvText);
  const need = (col: string | undefined) => (col && headers.includes(col));
  if (!need(mapping.date)) throw new ServiceError("bad_mapping", `Date column "${mapping.date}" not found in the file.`, 422);
  if (!need(mapping.description)) throw new ServiceError("bad_mapping", `Description column "${mapping.description}" not found.`, 422);
  const useAmount = !!mapping.amount;
  if (!useAmount && !mapping.debit && !mapping.credit) throw new ServiceError("bad_mapping", "Provide an amount column, or debit/credit columns.", 422);

  const parsed: ParsedRow[] = rows.map((r, i) => {
    const txnDate = parseDate(r[mapping.date] ?? "");
    const valueDate = mapping.valueDate ? parseDate(r[mapping.valueDate] ?? "") : null;
    const description = (r[mapping.description] ?? "").trim();
    const reference = mapping.reference ? (r[mapping.reference] ?? "").trim() || null : null;
    let amount: Prisma.Decimal | null = null;
    if (useAmount) amount = parseAmount(r[mapping.amount!]);
    else { const dr = parseAmount(mapping.debit ? r[mapping.debit] : undefined) ?? ZERO; const cr = parseAmount(mapping.credit ? r[mapping.credit] : undefined) ?? ZERO; amount = sub(cr, dr); }
    const runningBalance = mapping.balance ? parseAmount(r[mapping.balance]) : null;
    const currency = mapping.currency ? (r[mapping.currency] ?? "").trim().toUpperCase() || null : null;
    const issues: string[] = [];
    if (!txnDate) issues.push("invalid date");
    if (!description) issues.push("missing description");
    if (amount == null) issues.push("invalid amount");
    const dedupeKey = createHash("sha1").update([bankAccountId, txnDate?.toISOString().slice(0, 10) ?? "", amount?.toString() ?? "", reference ?? "", description].join("|")).digest("hex");
    return { index: i + 1, txnDate, valueDate, description, reference, amount, runningBalance, currency, issues, dedupeKey, duplicate: false };
  });

  // Duplicate detection: against already-imported lines for this account + within-file dups.
  const keys = parsed.map((p) => p.dedupeKey);
  const existing = keys.length ? await prisma.bankStatementLine.findMany({ where: { bankAccountId, dedupeKey: { in: keys } }, select: { dedupeKey: true } }) : [];
  const existingSet = new Set(existing.map((e) => e.dedupeKey));
  const seen = new Set<string>();
  for (const p of parsed) {
    if (existingSet.has(p.dedupeKey) || seen.has(p.dedupeKey)) p.duplicate = true;
    seen.add(p.dedupeKey);
  }
  return parsed;
}

async function loadBank(companyId: string, bankAccountId: string) {
  const bank = await prisma.bankAccount.findUnique({ where: { id: bankAccountId } });
  if (!bank || bank.companyId !== companyId || bank.archivedAt) throw new ServiceError("bad_account", "Bank account not found.", 422);
  return bank;
}

/** Preview a statement import: parsed rows with validation issues + duplicate flags. No write. */
export async function previewStatement(principal: Principal, companyId: string, bankAccountId: string, csvText: string, mapping: unknown) {
  assertCan(principal, "banks.manage", { companyId });
  await loadBank(companyId, bankAccountId);
  const m = columnMapping.parse(mapping);
  const rows = await parseRows(companyId, bankAccountId, csvText, m);
  const valid = rows.filter((r) => r.issues.length === 0 && !r.duplicate);
  const inflow = valid.reduce((s, r) => (r.amount && r.amount.greaterThan(0) ? add(s, r.amount) : s), ZERO);
  const outflow = valid.reduce((s, r) => (r.amount && r.amount.lessThan(0) ? add(s, r.amount.abs()) : s), ZERO);
  return { rows, summary: { total: rows.length, importable: valid.length, duplicates: rows.filter((r) => r.duplicate).length, invalid: rows.filter((r) => r.issues.length).length, inflow: inflow.toString(), outflow: outflow.toString() } };
}

export const importSchema = z.object({
  bankAccountId: z.string().min(1),
  label: z.string().trim().min(1).max(120),
  fileName: optionalString,
  csvText: z.string().min(1),
  mapping: columnMapping,
});

/** Commit a statement import: create the statement + non-duplicate valid lines. Never touches GL. */
export async function importStatement(ctx: ActorContext, companyId: string, raw: unknown) {
  assertCan(ctx.principal, "banks.manage", { companyId });
  const input = importSchema.parse(raw);
  const bank = await loadBank(companyId, input.bankAccountId);
  const rows = (await parseRows(companyId, input.bankAccountId, input.csvText, input.mapping)).filter((r) => r.issues.length === 0 && !r.duplicate);
  if (rows.length === 0) throw new ServiceError("nothing_to_import", "No valid, non-duplicate rows to import.", 422);
  const dates = rows.map((r) => r.txnDate!).sort((a, b) => a.getTime() - b.getTime());

  const statement = await prisma.$transaction(async (tx) => {
    const st = await tx.bankStatement.create({
      data: {
        companyId, bankAccountId: bank.id, label: input.label, fileName: input.fileName ?? null,
        statementFrom: dates[0], statementTo: dates[dates.length - 1],
        closingBalance: rows[rows.length - 1].runningBalance ?? null, lineCount: rows.length, createdById: ctx.principal.userId,
      },
    });
    await tx.bankStatementLine.createMany({
      data: rows.map((r) => ({
        statementId: st.id, companyId, bankAccountId: bank.id, txnDate: r.txnDate!, valueDate: r.valueDate,
        description: r.description, reference: r.reference, amount: r.amount!, currency: r.currency ?? bank.currency,
        runningBalance: r.runningBalance, dedupeKey: r.dedupeKey,
      })),
    });
    return st;
  });
  await audit(ctx, { action: "bank_statement.imported", entityType: "BankStatement", entityId: statement.id, summary: `${input.label} — ${rows.length} lines to ${bank.name}`, companyId });
  return statement;
}

export async function listStatements(principal: Principal, companyId: string, bankAccountId?: string) {
  assertCan(principal, "banks.view", { companyId });
  return prisma.bankStatement.findMany({ where: { companyId, ...(bankAccountId ? { bankAccountId } : {}) }, orderBy: { createdAt: "desc" }, take: 100, include: { bankAccount: { select: { name: true } }, _count: { select: { lines: true } } } });
}

export async function getStatement(principal: Principal, id: string) {
  const st = await prisma.bankStatement.findUnique({ where: { id }, include: { bankAccount: true, lines: { orderBy: { txnDate: "asc" } } } });
  if (!st) return null;
  if (!canFinance(principal, "banks.view", st.companyId)) throw new ServiceError("forbidden", "Forbidden", 403);
  return st;
}

// ---------------------------------------------------------------------------
// Suggested matching (§5)
// ---------------------------------------------------------------------------
function similar(a: string, b: string): boolean {
  const na = a.toLowerCase().replace(/[^a-z0-9]/g, ""), nb = b.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!na || !nb) return false;
  return na.includes(nb) || nb.includes(na);
}

/**
 * Suggest matches for an open reconciliation: pair each unmatched statement line
 * (for the reconciliation's bank account) with an unreconciled posted GL line whose
 * signed base amount equals the statement amount, ranked by date proximity + a
 * reference/description hint. Suggestions never auto-clear anything.
 */
export async function suggestMatches(principal: Principal, reconciliationId: string) {
  const rec = await prisma.bankReconciliation.findUnique({ where: { id: reconciliationId }, include: { bankAccount: true } });
  if (!rec) throw new ServiceError("not_found", "Reconciliation not found", 404);
  if (!canFinance(principal, "banks.view", rec.companyId)) throw new ServiceError("forbidden", "Forbidden", 403);
  const glAccountId = rec.bankAccount.glAccountId;
  if (!glAccountId) return { suggestions: [] };

  const [stLines, glLines] = await Promise.all([
    prisma.bankStatementLine.findMany({ where: { bankAccountId: rec.bankAccountId, status: "unmatched", txnDate: { lte: rec.statementDate } }, orderBy: { txnDate: "asc" } }),
    prisma.journalLine.findMany({ where: { companyId: rec.companyId, accountId: glAccountId, reconciliationId: null, entry: { status: "posted", postingDate: { lte: rec.statementDate } } }, include: { entry: { select: { journalNumber: true, postingDate: true, memo: true } } } }),
  ]);
  // Index GL lines by signed amount (debit − credit = inflow to a bank asset).
  const usedGl = new Set<string>();
  const suggestions = [] as { statementLineId: string; statementDesc: string; statementDate: Date; amount: string; journalLineId: string; journalNumber: string | null; confidence: number; reason: string }[];
  for (const s of stLines) {
    const target = D(s.amount);
    let best: { gl: (typeof glLines)[number]; confidence: number; reason: string } | null = null;
    for (const g of glLines) {
      if (usedGl.has(g.id)) continue;
      const glSigned = sub(D(g.debit), D(g.credit));
      if (!glSigned.equals(target)) continue;
      const days = Math.abs(Math.floor(((g.entry.postingDate ?? new Date()).getTime() - s.txnDate.getTime()) / 86400000));
      let confidence = days === 0 ? 0.9 : days <= 3 ? 0.8 : days <= 7 ? 0.65 : 0.5;
      const refHit = (s.reference && g.entry.memo && similar(s.reference, g.entry.memo)) || (g.description && similar(s.description, g.description));
      if (refHit) confidence = Math.min(0.99, confidence + 0.1);
      const reason = `amount exact · ${days}d apart${refHit ? " · reference match" : ""}`;
      if (!best || confidence > best.confidence) best = { gl: g, confidence, reason };
    }
    if (best) {
      usedGl.add(best.gl.id);
      suggestions.push({ statementLineId: s.id, statementDesc: s.description, statementDate: s.txnDate, amount: s.amount.toString(), journalLineId: best.gl.id, journalNumber: best.gl.entry.journalNumber, confidence: Math.round(best.confidence * 100), reason: best.reason });
    }
  }
  return { suggestions: suggestions.sort((a, b) => b.confidence - a.confidence) };
}

/** Confirm a match: link the statement line and clear the GL line to this reconciliation. Atomic. */
export async function confirmMatch(ctx: ActorContext, reconciliationId: string, statementLineId: string, journalLineId: string) {
  const rec = await prisma.bankReconciliation.findUnique({ where: { id: reconciliationId }, include: { bankAccount: true } });
  if (!rec) throw new ServiceError("not_found", "Reconciliation not found", 404);
  assertCan(ctx.principal, "banks.manage", { companyId: rec.companyId });
  if (rec.status === "completed") throw new ServiceError("completed", "Reconciliation is completed.", 422);
  const [st, gl] = await Promise.all([
    prisma.bankStatementLine.findUnique({ where: { id: statementLineId } }),
    prisma.journalLine.findUnique({ where: { id: journalLineId } }),
  ]);
  if (!st || st.bankAccountId !== rec.bankAccountId) throw new ServiceError("bad_line", "Statement line not found for this account.", 422);
  if (!gl || gl.companyId !== rec.companyId || gl.accountId !== rec.bankAccount.glAccountId) throw new ServiceError("bad_line", "Ledger line does not belong to this bank account.", 422);
  if (gl.reconciliationId && gl.reconciliationId !== reconciliationId) throw new ServiceError("already_cleared", "Ledger line is cleared on another reconciliation.", 422);
  if (st.status === "matched") throw new ServiceError("already_matched", "Statement line already matched.", 422);

  await prisma.$transaction(async (tx) => {
    await tx.journalLine.update({ where: { id: journalLineId }, data: { reconciliationId, reconciledAt: new Date() } });
    await tx.bankStatementLine.update({ where: { id: statementLineId }, data: { status: "matched", matchedJournalLineId: journalLineId, reconciliationId } });
    const g = await tx.journalLine.groupBy({ by: ["reconciliationId"], where: { reconciliationId }, _sum: { debit: true, credit: true } });
    const clearedBalance = g[0] ? sub(D(g[0]._sum.debit ?? 0), D(g[0]._sum.credit ?? 0)) : ZERO;
    await tx.bankReconciliation.update({ where: { id: reconciliationId }, data: { clearedBalance } });
  });
  await audit(ctx, { action: "reconciliation.matched", entityType: "BankReconciliation", entityId: reconciliationId, summary: `matched statement line ${roundMoney(st.amount, st.currency ?? "KWD")}`, companyId: rec.companyId });
}
