import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

/**
 * Concurrency-safe document numbering (§13/§75). Allocation runs inside the
 * caller's posting transaction and takes a row lock via `UPDATE ... RETURNING`, so
 * two simultaneous posts can never receive the same number (the second blocks on
 * the lock until the first commits). Sequences are per company + key + year.
 */
export interface AllocateInput {
  companyId: string;
  key: string; // stable sequence key, e.g. "journal:GJ", "invoice", "payment"
  prefix: string; // display prefix, e.g. "GJ"
  year: number;
  padding?: number;
}

export async function allocateNumber(tx: Prisma.TransactionClient, input: AllocateInput): Promise<string> {
  const seqKey = `${input.key}:${input.year}`;
  const padding = input.padding ?? 6;

  // Ensure the sequence row exists (no-op if present).
  await tx.numberSequence.upsert({
    where: { companyId_key: { companyId: input.companyId, key: seqKey } },
    create: { companyId: input.companyId, key: seqKey, prefix: input.prefix, year: input.year, nextValue: 1, padding },
    update: {},
  });

  // Atomically take the current value and bump — row-locked, so it is unique
  // under concurrency. RETURNING the pre-increment value is the allocated number.
  const rows = await tx.$queryRaw<{ allocated: number }[]>`
    UPDATE "NumberSequence"
    SET "nextValue" = "nextValue" + 1, "updatedAt" = now()
    WHERE "companyId" = ${input.companyId} AND "key" = ${seqKey}
    RETURNING "nextValue" - 1 AS "allocated"`;
  const n = rows[0]?.allocated ?? 1;
  return `${input.prefix}-${input.year}-${String(n).padStart(padding, "0")}`;
}
