import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { createReconciliation, setLineReconciled, completeReconciliation, getReconciliation } from "@/domain/accounting/bank";
import type { ActorContext } from "@/lib/action";
import type { Principal } from "@/lib/permissions/engine";

/**
 * Regression for audit FIN-04: a bank statement's closing balance is cumulative, so a
 * 2nd+ reconciliation must carry forward the balance cleared on earlier sessions.
 * Without the carry the 2nd statement can never balance.
 *
 * DB-gated: skips when no Postgres is reachable; runs in CI.
 */
const SUPER: Principal = { userId: "audit-fin", isSuperAdmin: true, assignments: [] };
const CTX: ActorContext = { principal: SUPER, ip: null, userAgent: null };
const P = "fintest_";
const co = P + "co", acct = P + "acct", bank = P + "bank";
let line1 = "", line2 = "";
const D1 = new Date("2026-01-31T00:00:00Z");
const D2 = new Date("2026-02-28T00:00:00Z");

let dbUp = false;
beforeAll(async () => {
  try { await prisma.$queryRaw`select 1`; dbUp = true; } catch { dbUp = false; return; }
  await cleanup();
  await prisma.company.create({ data: { id: co, name: "Fin Co", code: "FINCO" } });
  await prisma.account.create({ data: { id: acct, companyId: co, code: "1010", name: "Bank", type: "asset" } });
  await prisma.bankAccount.create({ data: { id: bank, companyId: co, name: "Main Bank", glAccountId: acct } });
  // Two posted deposits hitting the bank GL account: +100 in Jan, +50 in Feb.
  const e1 = await prisma.journalEntry.create({ data: { companyId: co, date: D1, postingDate: D1, status: "posted", journalNumber: P + "E1" } });
  line1 = (await prisma.journalLine.create({ data: { entryId: e1.id, accountId: acct, companyId: co, debit: 100, credit: 0 } })).id;
  const e2 = await prisma.journalEntry.create({ data: { companyId: co, date: D2, postingDate: D2, status: "posted", journalNumber: P + "E2" } });
  line2 = (await prisma.journalLine.create({ data: { entryId: e2.id, accountId: acct, companyId: co, debit: 50, credit: 0 } })).id;
});
afterAll(async () => { if (dbUp) await cleanup(); });

async function cleanup() {
  await prisma.bankReconciliation.deleteMany({ where: { companyId: co } }).catch(() => {});
  await prisma.journalLine.deleteMany({ where: { companyId: co } }).catch(() => {});
  await prisma.journalEntry.deleteMany({ where: { companyId: co } }).catch(() => {});
  await prisma.bankAccount.deleteMany({ where: { id: bank } }).catch(() => {});
  await prisma.account.deleteMany({ where: { id: acct } }).catch(() => {});
  await prisma.company.deleteMany({ where: { id: co } }).catch(() => {});
}

describe("FIN-04 — bank reconciliation carries the prior-cleared balance", () => {
  it("reconciles the 1st statement (no carry) and the 2nd (with carry)", async () => {
    if (!dbUp) return;

    // Statement 1: closing 100. Clear the Jan deposit and complete.
    const rec1 = await createReconciliation(CTX, co, { bankAccountId: bank, statementDate: D1, statementBalance: 100 });
    let v1 = await getReconciliation(SUPER, rec1.id);
    expect(Number(v1?.openingClearedBalance)).toBe(0); // first statement: nothing carried
    await setLineReconciled(CTX, rec1.id, line1, true);
    await expect(completeReconciliation(CTX, rec1.id)).resolves.toMatchObject({ status: "completed" });

    // Statement 2: cumulative closing 150. The carry must be the 100 cleared on rec1.
    const rec2 = await createReconciliation(CTX, co, { bankAccountId: bank, statementDate: D2, statementBalance: 150 });
    const v2 = await getReconciliation(SUPER, rec2.id);
    expect(Number(v2?.openingClearedBalance)).toBe(100); // carried forward from rec1

    // Before clearing the Feb line, it is short by 50 → cannot complete.
    await expect(completeReconciliation(CTX, rec2.id)).rejects.toThrow(/does not match|difference 50/i);

    // Clear the Feb deposit: opening 100 + this session 50 = 150 = statement → balances.
    const r = await setLineReconciled(CTX, rec2.id, line2, true);
    expect(Number(r.totalClearedBalance)).toBe(150);
    expect(Number(r.difference)).toBe(0);
    await expect(completeReconciliation(CTX, rec2.id)).resolves.toMatchObject({ status: "completed" });
  });
});
