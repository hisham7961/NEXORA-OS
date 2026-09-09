import { describe, it, expect } from "vitest";
import { accessibleScopeIds } from "@/lib/permissions/engine";
import { customAssignment, principal } from "./helpers";

/**
 * §13 (P0) — accessibleScopeIds scope-helper matrix. Regression coverage for the
 * combined-dimension footgun: a Brand+Country grant must yield [brandA] for the
 * brand dimension, never [] (which used to silently deny org-entity lists and
 * empty form dropdowns). Widening to "all" for an unrestricted dimension is safe
 * because the authoritative per-record check is can()/assertRecordInScope.
 */
const A = "brand_A", B = "brand_B", KW = "country_KW", CO = "co_A";
const P = "campaigns.view";

describe("accessibleScopeIds — single-dimension grants", () => {
  it("brand-only grant → that brand for brandId, all for country/company", () => {
    const p = principal([customAssignment([P], { brandId: A })]);
    expect(accessibleScopeIds(p, P, "brandId")).toEqual([A]);
    expect(accessibleScopeIds(p, P, "countryId")).toBe("all");
    expect(accessibleScopeIds(p, P, "companyId")).toBe("all");
  });
  it("country-only grant → that country for countryId, all for brand", () => {
    const p = principal([customAssignment([P], { countryId: KW })]);
    expect(accessibleScopeIds(p, P, "countryId")).toEqual([KW]);
    expect(accessibleScopeIds(p, P, "brandId")).toBe("all");
  });
  it("company-only grant → that company for companyId", () => {
    const p = principal([customAssignment([P], { companyId: CO })]);
    expect(accessibleScopeIds(p, P, "companyId")).toEqual([CO]);
  });
});

describe("accessibleScopeIds — combined-dimension grants (the fixed footgun)", () => {
  it("brand+country grant yields the brand (NOT []) for brandId", () => {
    const p = principal([customAssignment([P], { brandId: A, countryId: KW })]);
    expect(accessibleScopeIds(p, P, "brandId")).toEqual([A]);
    expect(accessibleScopeIds(p, P, "countryId")).toEqual([KW]);
  });
  it("company+brand grant yields both dimensions", () => {
    const p = principal([customAssignment([P], { companyId: CO, brandId: A })]);
    expect(accessibleScopeIds(p, P, "companyId")).toEqual([CO]);
    expect(accessibleScopeIds(p, P, "brandId")).toEqual([A]);
  });
  it("company+brand+country grant yields all three ids", () => {
    const p = principal([customAssignment([P], { companyId: CO, brandId: A, countryId: KW })]);
    expect(accessibleScopeIds(p, P, "companyId")).toEqual([CO]);
    expect(accessibleScopeIds(p, P, "brandId")).toEqual([A]);
    expect(accessibleScopeIds(p, P, "countryId")).toEqual([KW]);
  });
  it("multiple combined grants union their brand ids", () => {
    const p = principal([
      customAssignment([P], { brandId: A, countryId: KW }),
      customAssignment([P], { brandId: B, countryId: KW }),
    ]);
    expect(new Set(accessibleScopeIds(p, P, "brandId") as string[])).toEqual(new Set([A, B]));
  });
});

describe("accessibleScopeIds — grants, expiry, module, super", () => {
  it("a global (unscoped) grant → all", () => {
    const p = principal([customAssignment([P], {})]);
    expect(accessibleScopeIds(p, P, "brandId")).toBe("all");
  });
  it("an expired grant contributes nothing", () => {
    const past = new Date(Date.now() - 1000);
    const p = principal([customAssignment([P], { brandId: A, expiresAt: past })]);
    expect(accessibleScopeIds(p, P, "brandId")).toEqual([]);
  });
  it("a module-restricted assignment only applies to its module", () => {
    const p = principal([customAssignment([P, "cases.view"], { brandId: A, moduleKey: "cases" })]);
    // Asking for campaigns while the assignment is pinned to cases ⇒ no contribution.
    expect(accessibleScopeIds(p, "campaigns.view", "brandId")).toEqual([]);
    expect(accessibleScopeIds(p, "cases.view", "brandId")).toEqual([A]);
  });
  it("a department/team-only restriction (no C/B/C dim) still grants all of an org dimension", () => {
    const p = principal([customAssignment([P], { departmentId: "dep_1" })]);
    // The grant doesn't restrict brandId, so all brands are selectable; the real
    // record check enforces the department scope where the model supports it.
    expect(accessibleScopeIds(p, P, "brandId")).toBe("all");
  });
  it("a super admin gets all for any dimension", () => {
    const p = principal([], { isSuperAdmin: true });
    expect(accessibleScopeIds(p, P, "brandId")).toBe("all");
    expect(accessibleScopeIds(p, P, "companyId")).toBe("all");
  });
  it("no granting assignment → empty (fail-closed)", () => {
    const p = principal([customAssignment(["cases.view"], { brandId: A })]);
    expect(accessibleScopeIds(p, "campaigns.view", "brandId")).toEqual([]);
  });
});
