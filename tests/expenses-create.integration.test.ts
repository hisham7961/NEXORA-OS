import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { createExpense } from "@/domain/expenses";
import type { ActorContext } from "@/lib/action";
import type { Principal } from "@/lib/permissions/engine";

/**
 * Regression for audit DOM-06: Expenses gained a claimant submit path. Exercises the
 * real domain function — scope-guarded create, money rounded to currency, filed as
 * `pending` with the actor stamped as submitter, and the cross-company category guard.
 *
 * DB-gated: skips when no Postgres is reachable; runs in CI.
 */
const SUPER: Principal = { userId: "audit-exp", isSuperAdmin: true, assignments: [] };
const CTX: ActorContext = { principal: SUPER, ip: null, userAgent: null };
const P = "exptest_";
const coA = P + "coA", coB = P + "coB", cat = P + "cat";

let dbUp = false;
beforeAll(async () => {
  try { await prisma.$queryRaw`select 1`; dbUp = true; } catch { dbUp = false; return; }
  await cleanup();
  await prisma.company.create({ data: { id: coA, name: "Exp Co A", code: "EXPCOA" } });
  await prisma.company.create({ data: { id: coB, name: "Exp Co B", code: "EXPCOB" } });
  // Category scoped to company B — used to prove the cross-company guard.
  await prisma.expenseCategory.create({ data: { id: cat, name: "Travel (Co B)", companyId: coB } });
});
afterAll(async () => { if (dbUp) await cleanup(); });

async function cleanup() {
  await prisma.expense.deleteMany({ where: { companyId: { in: [coA, coB] } } }).catch(() => {});
  await prisma.expenseCategory.deleteMany({ where: { id: cat } }).catch(() => {});
  await prisma.company.deleteMany({ where: { id: { in: [coA, coB] } } }).catch(() => {});
}

const today = new Date().toISOString().slice(0, 10);

describe("DOM-06 — file an expense", () => {
  it("creates a pending expense with the actor as submitter and money rounded", async () => {
    if (!dbUp) return;
    const exp = await createExpense(CTX, {
      amount: "12.3456", currency: "kwd", date: today, description: "Taxi",
      companyId: coA, taxAmount: "0.5",
    });
    expect(exp.companyId).toBe(coA);
    expect(exp.status).toBe("pending");
    expect(exp.submittedById).toBe("audit-exp");
    expect(exp.currency).toBe("KWD");
    expect(Number(exp.amount)).toBeCloseTo(12.346, 3); // rounded to KWD's 3 minor units
    expect(exp.journalEntryId).toBeNull(); // never touches the ledger
  });

  it("rejects a zero / non-positive amount", async () => {
    if (!dbUp) return;
    await expect(createExpense(CTX, { amount: "0", date: today, companyId: coA })).rejects.toThrow();
  });

  it("rejects a category from a different company", async () => {
    if (!dbUp) return;
    // cat belongs to coB; filing under coA must fail.
    await expect(createExpense(CTX, { amount: "5", date: today, companyId: coA, categoryId: cat })).rejects.toThrow();
  });

  it("accepts a category matching the expense company", async () => {
    if (!dbUp) return;
    const exp = await createExpense(CTX, { amount: "5", date: today, companyId: coB, categoryId: cat });
    expect(exp.categoryId).toBe(cat);
    expect(exp.companyId).toBe(coB);
  });
});
