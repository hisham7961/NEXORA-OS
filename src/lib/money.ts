import { Prisma } from "@prisma/client";

/**
 * Decimal-safe money arithmetic (§15/§16/§77). All financial math uses
 * Prisma.Decimal (decimal.js) — never JavaScript floating point. Currencies carry
 * different minor units (KWD = 3 decimals, most = 2, JPY = 0); rounding and the
 * journal-balancing tolerance derive from that.
 */
export type Money = Prisma.Decimal;
export const D = (v: Prisma.Decimal.Value = 0): Money => new Prisma.Decimal(v);
export const ZERO = D(0);

/** Minor units (decimal places) by ISO currency. Default 2. */
const MINOR_UNITS: Record<string, number> = {
  KWD: 3, BHD: 3, OMR: 3, TND: 3, JOD: 3, LYD: 3,
  JPY: 0, KRW: 0, VND: 0, CLP: 0, ISK: 0,
};
export function minorUnits(currency: string): number {
  return MINOR_UNITS[currency?.toUpperCase()] ?? 2;
}

type RoundingMode = "half_up" | "half_even" | "down" | "up";
const ROUND_MAP: Record<RoundingMode, Prisma.Decimal.Rounding> = {
  half_up: Prisma.Decimal.ROUND_HALF_UP,
  half_even: Prisma.Decimal.ROUND_HALF_EVEN,
  down: Prisma.Decimal.ROUND_DOWN,
  up: Prisma.Decimal.ROUND_UP,
};

/** Round an amount to a currency's minor units with the given policy. */
export function roundMoney(amount: Prisma.Decimal.Value, currency: string, mode: RoundingMode = "half_up"): Money {
  return D(amount).toDecimalPlaces(minorUnits(currency), ROUND_MAP[mode]);
}

export const add = (...vals: Prisma.Decimal.Value[]): Money => vals.reduce<Money>((acc, v) => acc.add(v), ZERO);
export const sub = (a: Prisma.Decimal.Value, b: Prisma.Decimal.Value): Money => D(a).sub(b);
export const mul = (a: Prisma.Decimal.Value, b: Prisma.Decimal.Value): Money => D(a).mul(b);
export const isZero = (v: Prisma.Decimal.Value): boolean => D(v).isZero();
export const isNeg = (v: Prisma.Decimal.Value): boolean => D(v).lessThan(0);
export const eq = (a: Prisma.Decimal.Value, b: Prisma.Decimal.Value): boolean => D(a).equals(b);
export const gt = (a: Prisma.Decimal.Value, b: Prisma.Decimal.Value): boolean => D(a).greaterThan(b);
export const gte = (a: Prisma.Decimal.Value, b: Prisma.Decimal.Value): boolean => D(a).greaterThanOrEqualTo(b);

/**
 * Convert a transaction amount to base currency at a rate and round to base minor
 * units. `rate` is base-per-transaction (transactionAmount × rate = baseAmount).
 */
export function toBase(amount: Prisma.Decimal.Value, rate: Prisma.Decimal.Value, baseCurrency: string, mode: RoundingMode = "half_up"): Money {
  return roundMoney(mul(amount, rate), baseCurrency, mode);
}

/** The balancing tolerance for a base currency = half its smallest minor unit. */
export function balancingTolerance(baseCurrency: string): Money {
  const units = minorUnits(baseCurrency);
  return D(1).div(D(10).pow(units)); // 1 minor unit; entries must balance to the cent
}

/** True if a set of debits and credits balance within tolerance (in base currency). */
export function balances(totalDebit: Prisma.Decimal.Value, totalCredit: Prisma.Decimal.Value, baseCurrency: string): boolean {
  return sub(totalDebit, totalCredit).abs().lessThanOrEqualTo(balancingTolerance(baseCurrency));
}
