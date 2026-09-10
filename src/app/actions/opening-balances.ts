"use server";

import { runAction, type ActionResult } from "@/lib/action";
import { postOpeningBalances } from "@/domain/accounting/opening-balances";

export async function postOpeningBalancesAction(
  companyId: string,
  input: { asOfDate: string; equityAccountId: string; lines: { accountId: string; debit: number; credit: number }[] },
): Promise<ActionResult<{ entryId: string; number: string }>> {
  return runAction(async (ctx) => {
    const entry = await postOpeningBalances(ctx, companyId, input);
    return { entryId: entry.id, number: entry.journalNumber ?? entry.id };
  });
}
