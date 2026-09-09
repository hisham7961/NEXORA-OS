import { describe, it, expect } from "vitest";
import { D, add, sub, mul, roundMoney, minorUnits, toBase, balances, balancingTolerance } from "@/lib/money";

/**
 * §15/§16/§77 — Decimal-safe money. These lock the arithmetic and rounding that
 * every posting depends on. No JavaScript floating point.
 */
describe("money arithmetic", () => {
  it("adds without float error (0.1 + 0.2 = 0.3)", () => {
    expect(add(0.1, 0.2).toString()).toBe("0.3");
  });
  it("multiplies exactly", () => {
    expect(mul("1.005", 100).toString()).toBe("100.5");
  });
  it("subtracts exactly", () => {
    expect(sub("100.00", "33.33").toString()).toBe("66.67");
  });
});

describe("currency minor units + rounding", () => {
  it("knows KWD=3, USD=2, JPY=0", () => {
    expect(minorUnits("KWD")).toBe(3);
    expect(minorUnits("USD")).toBe(2);
    expect(minorUnits("JPY")).toBe(0);
    expect(minorUnits("xyz")).toBe(2); // default
  });
  it("rounds KWD to 3 dp and USD to 2 dp", () => {
    expect(roundMoney("1.23456", "KWD").toString()).toBe("1.235");
    expect(roundMoney("1.235", "USD").toString()).toBe("1.24"); // half up
    expect(roundMoney("1050", "JPY").toString()).toBe("1050");
  });
  it("half_even rounds to nearest even", () => {
    expect(roundMoney("2.5", "JPY", "half_even").toString()).toBe("2");
    expect(roundMoney("3.5", "JPY", "half_even").toString()).toBe("4");
  });
});

describe("base conversion + balancing", () => {
  it("converts a transaction amount to base and rounds", () => {
    // 100 USD at 0.307 KWD/USD = 30.7 KWD
    expect(toBase("100", "0.307", "KWD").toString()).toBe("30.7");
  });
  it("balancing tolerance is one minor unit of the base currency", () => {
    expect(balancingTolerance("KWD").toString()).toBe("0.001");
    expect(balancingTolerance("USD").toString()).toBe("0.01");
  });
  it("balances within tolerance and rejects beyond it", () => {
    expect(balances("100.00", "100.00", "USD")).toBe(true);
    expect(balances("100.00", "100.01", "USD")).toBe(true); // exactly one cent → within tolerance
    expect(balances("100.00", "100.02", "USD")).toBe(false);
    expect(balances(D("50.001"), D("50.000"), "KWD")).toBe(true);
    expect(balances(D("50.002"), D("50.000"), "KWD")).toBe(false);
  });
});
