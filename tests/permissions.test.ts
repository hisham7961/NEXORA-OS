import { describe, it, expect } from "vitest";
import {
  can,
  canAnywhere,
  scopeWhereFor,
  accessibleScopeIds,
} from "@/lib/permissions/engine";
import { assignment, customAssignment, principal } from "./helpers";

const CBC = ["companyId", "brandId", "countryId"] as const;

describe("permission engine — basic grants", () => {
  it("super admin can do everything, unscoped", () => {
    const p = principal([], { isSuperAdmin: true });
    expect(can(p, "finance.view_values")).toBe(true);
    expect(can(p, "campaigns.delete", { brandId: "any", countryId: "any" })).toBe(true);
    expect(scopeWhereFor(p, "campaigns.view", [...CBC])).toEqual({});
    expect(accessibleScopeIds(p, "brands.view", "brandId")).toBe("all");
  });

  it("a user with no assignments is denied", () => {
    const p = principal([]);
    expect(can(p, "tasks.view")).toBe(false);
    expect(canAnywhere(p, "tasks.view")).toBe(false);
    expect(scopeWhereFor(p, "tasks.view", [...CBC])).toEqual({ id: "__deny_all__" });
  });

  it("`manage` implies the standard actions for that module", () => {
    const p = principal([customAssignment(["campaigns.manage"], { brandId: "A" })]);
    expect(can(p, "campaigns.edit", { brandId: "A" })).toBe(true);
    expect(can(p, "campaigns.delete", { brandId: "A" })).toBe(true);
    expect(can(p, "campaigns.view", { brandId: "A" })).toBe(true);
    // but not another module
    expect(can(p, "finance.edit", { brandId: "A" })).toBe(false);
  });

  it("expired assignments are ignored", () => {
    const past = new Date(Date.now() - 1000);
    const p = principal([customAssignment(["campaigns.view"], { brandId: "A", expiresAt: past })]);
    expect(can(p, "campaigns.view", { brandId: "A" })).toBe(false);
  });
});

describe("scope-based access (§3)", () => {
  // Marketing Manager for Brand A, in Kuwait AND UAE only.
  const A = "brand_A";
  const KW = "country_KW";
  const AE = "country_AE";
  const p = principal([
    assignment("marketing_manager", { brandId: A, countryId: KW }),
    assignment("marketing_manager", { brandId: A, countryId: AE }),
  ]);

  it("grants within the exact brand+country scope", () => {
    expect(can(p, "campaigns.edit", { brandId: A, countryId: KW })).toBe(true);
    expect(can(p, "campaigns.edit", { brandId: A, countryId: AE })).toBe(true);
  });

  it("denies a different country of the same brand", () => {
    expect(can(p, "campaigns.edit", { brandId: A, countryId: "country_SA" })).toBe(false);
  });

  it("denies a different brand", () => {
    expect(can(p, "campaigns.edit", { brandId: "brand_B", countryId: KW })).toBe(false);
  });

  it("is fail-closed when the record's country is unknown", () => {
    // The assignment restricts country; a context that omits country must not match.
    expect(can(p, "campaigns.edit", { brandId: A })).toBe(false);
  });

  it("does not grant modules the role lacks", () => {
    // marketing_manager has no finance permissions
    expect(can(p, "finance.view_values", { brandId: A, countryId: KW })).toBe(false);
    expect(canAnywhere(p, "finance.view")).toBe(false);
  });

  it("builds an OR scope filter listing each accessible (brand,country) pair", () => {
    const where = scopeWhereFor(p, "campaigns.view", [...CBC]);
    expect(where).toEqual({ OR: [{ brandId: A, countryId: KW }, { brandId: A, countryId: AE }] });
  });
});

describe("accessibleScopeIds (org-entity lists)", () => {
  it("returns the concrete brand ids a brand-scoped viewer may list", () => {
    const p = principal([customAssignment(["brands.view"], { brandId: "A" }), customAssignment(["brands.view"], { brandId: "B" })]);
    const ids = accessibleScopeIds(p, "brands.view", "brandId");
    expect(ids).not.toBe("all");
    expect(new Set(ids as string[])).toEqual(new Set(["A", "B"]));
  });

  it("returns 'all' when a granting assignment has no brand restriction", () => {
    const p = principal([customAssignment(["brands.view"], {})]);
    expect(accessibleScopeIds(p, "brands.view", "brandId")).toBe("all");
  });
});
