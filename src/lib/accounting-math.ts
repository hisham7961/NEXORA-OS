import type { Prisma } from "@prisma/client";
import { D, ZERO, add, sub, mul, roundMoney } from "@/lib/money";

/**
 * Pure document-line arithmetic shared by AR and AP (§Increment C/D). Kept free of
 * Prisma/permissions so it is unit-testable in isolation — this is the money math
 * every invoice/bill/credit line runs through. Decimal-safe (§15/§16).
 */
export type TaxComputation = "exclusive" | "inclusive";
export type RoundingMode = "half_up" | "half_even" | "down" | "up";

export interface LineInput {
  quantity: Prisma.Decimal.Value;
  unitPrice: Prisma.Decimal.Value;
  discountPct?: Prisma.Decimal.Value; // 0..100
  taxRatePct?: Prisma.Decimal.Value | null; // null/undefined = no tax
  taxComputation?: TaxComputation;
  currency: string;
  rounding?: RoundingMode;
}

/**
 * Net (of tax, after discount) and tax amount for one line, each rounded to the
 * currency's minor units. Exclusive: net = qty·price·(1−disc); tax = net·rate.
 * Inclusive: the gross already includes tax, so net = gross/(1+rate).
 */
export function lineAmounts(input: LineInput): { lineNet: Prisma.Decimal; taxAmount: Prisma.Decimal } {
  const { currency } = input;
  const rounding = input.rounding ?? "half_up";
  const disc = D(input.discountPct ?? 0).div(100);
  const gross = mul(mul(input.quantity, input.unitPrice), sub(1, disc));
  const ratePct = input.taxRatePct == null ? null : D(input.taxRatePct);

  if (ratePct && input.taxComputation === "inclusive") {
    const grossR = roundMoney(gross, currency, rounding);
    const lineNet = roundMoney(D(grossR).div(add(1, ratePct.div(100))), currency, rounding);
    return { lineNet, taxAmount: sub(grossR, lineNet) };
  }
  const lineNet = roundMoney(gross, currency, rounding);
  const taxAmount = ratePct ? roundMoney(mul(lineNet, ratePct.div(100)), currency, rounding) : ZERO;
  return { lineNet, taxAmount };
}

/**
 * The FX residual of a cross-currency transfer: source-base minus destination-base.
 * A positive residual is an FX loss (source cost exceeds destination value), a
 * negative one an FX gain. Used to plug the transfer journal so it balances (§E).
 */
export function fxResidual(fromBase: Prisma.Decimal.Value, toBase: Prisma.Decimal.Value): { kind: "loss" | "gain" | "none"; amount: Prisma.Decimal } {
  const residual = sub(fromBase, toBase);
  if (residual.isZero()) return { kind: "none", amount: ZERO };
  return residual.greaterThan(0) ? { kind: "loss", amount: residual } : { kind: "gain", amount: residual.abs() };
}
