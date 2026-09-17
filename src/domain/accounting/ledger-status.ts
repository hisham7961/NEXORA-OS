/**
 * Journal-entry statuses that count toward a ledger BALANCE.
 *
 * A reversal (see `reverseEntry` in posting.ts) posts a **contra** entry with
 * `status: "posted"` and flips the original to `status: "reversed"`. Both entries
 * remain on the books and net to zero — that is what makes a reversal a reversal.
 *
 * Therefore every query that computes an account BALANCE or a financial-report
 * figure by summing `JournalLine`s must include BOTH `posted` and `reversed`
 * entries. Including only `posted` drops the reversed original while keeping its
 * contra, so the balance moves by the *negative* of the original amount instead
 * of returning to zero — double-counting the reversal (audit finding FIN-01).
 *
 * Do NOT use this for mutability/lifecycle guards (e.g. "only a posted entry can
 * be reversed", "is this expense already posted"): those must keep matching the
 * exact `"posted"` literal.
 */
export const LEDGER_STATUSES: string[] = ["posted", "reversed"];
