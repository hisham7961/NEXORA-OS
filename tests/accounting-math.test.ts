import { describe, it, expect } from "vitest";
import { lineAmounts, fxResidual } from "@/lib/accounting-math";

/**
 * §C/§D/§E — the pure document-line + FX math every invoice, bill and transfer
 * runs through. Decimal-safe; currency minor units respected. No floating point.
 */
describe("lineAmounts — exclusive tax", () => {
  it("net = qty·price, tax = net·rate (5% on 1000)", () => {
    const r = lineAmounts({ quantity: 1, unitPrice: 1000, taxRatePct: 5, taxComputation: "exclusive", currency: "KWD" });
    expect(r.lineNet.toString()).toBe("1000");
    expect(r.taxAmount.toString()).toBe("50");
  });
  it("applies a percentage discount before tax", () => {
    // 10 × 100 = 1000, less 10% = 900 net, 5% tax = 45
    const r = lineAmounts({ quantity: 10, unitPrice: 100, discountPct: 10, taxRatePct: 5, taxComputation: "exclusive", currency: "KWD" });
    expect(r.lineNet.toString()).toBe("900");
    expect(r.taxAmount.toString()).toBe("45");
  });
  it("no tax rate → zero tax", () => {
    const r = lineAmounts({ quantity: 3, unitPrice: 33.5, currency: "KWD" });
    expect(r.lineNet.toString()).toBe("100.5");
    expect(r.taxAmount.toString()).toBe("0");
  });
  it("rounds tax to the currency's minor units (KWD=3, USD=2)", () => {
    const kwd = lineAmounts({ quantity: 1, unitPrice: 33.333, taxRatePct: 5, taxComputation: "exclusive", currency: "KWD" });
    expect(kwd.taxAmount.toString()).toBe("1.667"); // 33.333 × 0.05 = 1.66665 → 1.667
    const usd = lineAmounts({ quantity: 1, unitPrice: 33.33, taxRatePct: 5, taxComputation: "exclusive", currency: "USD" });
    expect(usd.taxAmount.toString()).toBe("1.67"); // 1.6665 → 1.67
  });
});

describe("lineAmounts — inclusive tax", () => {
  it("extracts tax from a tax-inclusive gross (105 incl. 5% → 100 net + 5 tax)", () => {
    const r = lineAmounts({ quantity: 1, unitPrice: 105, taxRatePct: 5, taxComputation: "inclusive", currency: "KWD" });
    expect(r.lineNet.toString()).toBe("100");
    expect(r.taxAmount.toString()).toBe("5");
  });
  it("net + tax always reconstructs the gross", () => {
    const r = lineAmounts({ quantity: 1, unitPrice: 100, taxRatePct: 5, taxComputation: "inclusive", currency: "USD" });
    expect(r.lineNet.add(r.taxAmount).toString()).toBe("100");
  });
});

describe("fxResidual", () => {
  it("source base exceeds destination → FX loss", () => {
    const r = fxResidual("310", "305");
    expect(r.kind).toBe("loss");
    expect(r.amount.toString()).toBe("5");
  });
  it("destination base exceeds source → FX gain (absolute amount)", () => {
    const r = fxResidual("300", "312");
    expect(r.kind).toBe("gain");
    expect(r.amount.toString()).toBe("12");
  });
  it("equal legs → no residual", () => {
    const r = fxResidual("100", "100");
    expect(r.kind).toBe("none");
    expect(r.amount.toString()).toBe("0");
  });
});
