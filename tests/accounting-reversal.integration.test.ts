import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { trialBalance } from "@/domain/accounting/reports";
import { LEDGER_STATUSES } from "@/domain/accounting/ledger-status";
import type { Principal } from "@/lib/permissions/engine";

/**
 * Regression for audit finding FIN-01 (P0): a reversal posts a contra entry and
 * flips the original to status "reversed". Ledger-balance queries must count BOTH
 * so the pair nets to zero. The pre-fix code filtered status="posted" only, which
 * dropped the reversed original while keeping its contra — moving the reported
 * balance by the NEGATIVE of the original amount (double-counting the reversal).
 *
 * This test drives the real `trialBalance` report over a reversed pair. Under the
 * bug, account A would show a 100 credit after reversal; correct is net zero.
 *
 * DB-gated: skips cleanly when no Postgres is reachable (unit-only environments);
 * runs in CI, which provisions Postgres and applies migrations before the suite.
 */
const SUPER: Principal = { userId: "audit-fin01", isSuperAdmin: true, assignments: [] };
const P = "fin01test_";
const co = P + "co", jr = P + "jr", accA = P + "A", accB = P + "B", e1 = P + "e1", e2 = P + "e2";

let dbUp = false;
beforeAll(async () => {
  try { await prisma.$queryRaw`select 1`; dbUp = true; } catch { dbUp = false; return; }
  await cleanup();
  await prisma.company.create({ data: { id: co, name: "FIN01 Co", code: "FIN01" } });
  await prisma.journal.create({ data: { id: jr, companyId: co, code: "GEN", name: "General" } });
  await prisma.account.create({ data: { id: accA, companyId: co, code: "1000", name: "Asset A", type: "asset" } });
  await prisma.account.create({ data: { id: accB, companyId: co, code: "4000", name: "Revenue B", type: "revenue" } });
  // Original posted entry: Dr A 100 / Cr B 100
  await prisma.journalEntry.create({ data: { id: e1, companyId: co, journalId: jr, status: "posted", date: new Date(), postingDate: new Date(), currency: "KWD", baseCurrency: "KWD", journalNumber: "JE-1" } });
  await prisma.journalLine.createMany({ data: [
    { id: e1 + "_l1", entryId: e1, accountId: accA, debit: 100, credit: 0, companyId: co, lineNo: 1 },
    { id: e1 + "_l2", entryId: e1, accountId: accB, debit: 0, credit: 100, companyId: co, lineNo: 2 },
  ] });
});

afterAll(async () => { if (dbUp) await cleanup(); });

async function cleanup() {
  await prisma.journalLine.deleteMany({ where: { companyId: co } }).catch(() => {});
  await prisma.journalEntry.deleteMany({ where: { companyId: co } }).catch(() => {});
  await prisma.account.deleteMany({ where: { companyId: co } }).catch(() => {});
  await prisma.journal.deleteMany({ where: { companyId: co } }).catch(() => {});
  await prisma.company.deleteMany({ where: { id: co } }).catch(() => {});
}

describe("FIN-01 — a reversed entry nets to zero in ledger reports", () => {
  it("LEDGER_STATUSES includes both posted and reversed", () => {
    expect(LEDGER_STATUSES).toContain("posted");
    expect(LEDGER_STATUSES).toContain("reversed");
  });

  it("before reversal, account A carries the 100 debit", async () => {
    if (!dbUp) return;
    const tb = await trialBalance(SUPER, co);
    const a = tb.rows.find((r) => r.accountId === accA)!;
    expect(a.debit).toBe("100");
    expect(tb.balanced).toBe(true);
  });

  it("after reversal (original→reversed + posted contra), A nets to zero", async () => {
    if (!dbUp) return;
    // Simulate exactly what reverseEntry does: flip original, post contra with flipped lines.
    await prisma.journalEntry.update({ where: { id: e1 }, data: { status: "reversed" } });
    await prisma.journalEntry.create({ data: { id: e2, companyId: co, journalId: jr, status: "posted", date: new Date(), postingDate: new Date(), currency: "KWD", baseCurrency: "KWD", journalNumber: "JE-1R", sourceType: "Reversal", reversalOfEntryId: e1 } });
    await prisma.journalLine.createMany({ data: [
      { id: e2 + "_l1", entryId: e2, accountId: accA, debit: 0, credit: 100, companyId: co, lineNo: 1 },
      { id: e2 + "_l2", entryId: e2, accountId: accB, debit: 100, credit: 0, companyId: co, lineNo: 2 },
    ] });

    const tb = await trialBalance(SUPER, co);
    const a = tb.rows.find((r) => r.accountId === accA);
    // Correct: A contributes zero (original +100 nets the contra -100). Pre-fix bug: A shows credit 100.
    expect(a ? a.debit : "0").toBe("0");
    expect(a ? a.credit : "0").toBe("0");
    expect(tb.balanced).toBe(true);
    expect(tb.totalDebit).toBe("0");
    expect(tb.totalCredit).toBe("0");
  });
});
