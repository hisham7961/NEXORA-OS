import { describe, it, expect } from "vitest";
import { deriveStoreMetrics } from "@/domain/stores";

/**
 * Phase 2.5 §2 — the store-performance metric dictionary (docs/METRIC_DICTIONARY.md)
 * is the single source of truth; these assert the derivation matches it exactly.
 */
describe("store performance derivation", () => {
  it("computes net sales, AOV, gross profit and net contribution", () => {
    const m = deriveStoreMetrics({ sales: 1000, discounts: 50, refunds: 30, cogs: 400, adSpend: 100, shippingCost: 20, orders: 40 });
    expect(m.netSales).toBe(920); // 1000 - 50 - 30
    expect(m.aov).toBe(23); // 920 / 40
    expect(m.grossMargin).toBe(520); // 920 - 400  (gross profit)
    expect(m.netContribution).toBe(400); // 520 - 100 - 20
  });
  it("treats missing components as zero", () => {
    const m = deriveStoreMetrics({ sales: 500, orders: 10 });
    expect(m.netSales).toBe(500);
    expect(m.aov).toBe(50);
    expect(m.grossMargin).toBeNull(); // no COGS entered → gross profit undefined
    expect(m.netContribution).toBeNull();
  });
  it("returns null AOV when there are no orders", () => {
    const m = deriveStoreMetrics({ sales: 500, orders: 0 });
    expect(m.aov).toBeNull();
  });
  it("uses discounts (previously ignored) in net sales", () => {
    const withDiscount = deriveStoreMetrics({ sales: 1000, discounts: 100, orders: 10 });
    const without = deriveStoreMetrics({ sales: 1000, orders: 10 });
    expect(withDiscount.netSales).toBe(900);
    expect(without.netSales).toBe(1000);
  });
});
