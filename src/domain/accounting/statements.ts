import type { Prisma } from "@prisma/client";
import type { Principal } from "@/lib/permissions/engine";
import { prisma } from "@/lib/db";
import { assertCan } from "@/domain/mutation";
import { D, ZERO, add, sub } from "@/lib/money";

/**
 * Financial statements beyond the core reports (§Increment F). The Cash Flow
 * statement is direct-method: cash movements in the period are attributed to their
 * counterpart accounts (the non-cash side of each cash-touching entry) and grouped
 * into operating / investing / financing. Derived only from posted ledger lines.
 */

function categoryFor(type: string, subtype: string | null): "operating" | "investing" | "financing" {
  if (subtype === "fixed_asset") return "investing";
  if (type === "equity" || subtype === "loan" || subtype === "capital" || subtype === "retained_earnings") return "financing";
  return "operating";
}

async function cashAccountIds(companyId: string): Promise<string[]> {
  const [banks, accts] = await Promise.all([
    prisma.bankAccount.findMany({ where: { companyId, archivedAt: null }, select: { glAccountId: true } }),
    prisma.account.findMany({ where: { companyId, subtype: { in: ["cash", "bank"] } }, select: { id: true } }),
  ]);
  const ids = new Set<string>();
  for (const b of banks) if (b.glAccountId) ids.add(b.glAccountId);
  for (const a of accts) ids.add(a.id);
  return [...ids];
}

/** Cash Flow statement (direct method) for a period. */
export async function cashFlow(principal: Principal, companyId: string, from: Date, to: Date) {
  assertCan(principal, "accounting.view", { companyId });
  const cashIds = await cashAccountIds(companyId);
  if (cashIds.length === 0) return { from, to, opening: "0", closing: "0", netChange: "0", categories: [], rows: [] };

  // Opening / closing cash balance (sum debit-credit on cash accounts).
  const bal = async (upto: Date, inclusive: boolean) => {
    const g = await prisma.journalLine.groupBy({ by: ["accountId"], where: { companyId, accountId: { in: cashIds }, entry: { status: "posted", postingDate: inclusive ? { lte: upto } : { lt: upto } } }, _sum: { debit: true, credit: true } });
    return g.reduce((s, r) => add(s, sub(D(r._sum.debit ?? 0), D(r._sum.credit ?? 0))), ZERO);
  };
  const opening = await bal(from, false);
  const closing = await bal(to, true);

  // Entries in the period that touch a cash account.
  const cashLines = await prisma.journalLine.findMany({ where: { companyId, accountId: { in: cashIds }, entry: { status: "posted", postingDate: { gte: from, lte: to } } }, select: { entryId: true } });
  const entryIds = [...new Set(cashLines.map((l) => l.entryId))];
  if (entryIds.length === 0) return { from, to, opening: opening.toString(), closing: closing.toString(), netChange: sub(closing, opening).toString(), categories: [], rows: [] };

  // Non-cash lines of those entries carry the counterpart; cash effect = credit − debit.
  const nonCash = await prisma.journalLine.findMany({
    where: { entryId: { in: entryIds }, accountId: { notIn: cashIds } },
    select: { debit: true, credit: true, accountId: true },
  });
  const accts = await prisma.account.findMany({ where: { companyId }, select: { id: true, code: true, name: true, type: true, subtype: true } });
  const byId = new Map(accts.map((a) => [a.id, a]));

  const byAccount = new Map<string, { code: string; name: string; category: string; flow: Prisma.Decimal }>();
  const byCategory = new Map<string, Prisma.Decimal>();
  for (const l of nonCash) {
    const a = byId.get(l.accountId); if (!a) continue;
    const flow = sub(D(l.credit), D(l.debit)); // + = cash inflow
    const cat = categoryFor(a.type, a.subtype);
    const row = byAccount.get(l.accountId) ?? { code: a.code, name: a.name, category: cat, flow: ZERO };
    row.flow = add(row.flow, flow);
    byAccount.set(l.accountId, row);
    byCategory.set(cat, add(byCategory.get(cat) ?? ZERO, flow));
  }

  const rows = [...byAccount.entries()].map(([accountId, r]) => ({ accountId, code: r.code, name: r.name, category: r.category, flow: r.flow.toString() })).filter((r) => r.flow !== "0").sort((x, y) => x.category.localeCompare(y.category) || x.code.localeCompare(y.code));
  const categories = ["operating", "investing", "financing"].map((c) => ({ category: c, net: (byCategory.get(c) ?? ZERO).toString() }));
  return { from, to, opening: opening.toString(), closing: closing.toString(), netChange: sub(closing, opening).toString(), categories, rows };
}
