import { describe, it, expect } from "vitest";
import { assertRecordInScope, ForbiddenError } from "@/lib/permissions/engine";
import { assignment, principal } from "./helpers";

/**
 * §69 CRITICAL SECURITY TEST
 * An employee assigned to Brand A / Kuwait must NOT retrieve Brand A / UAE or
 * Brand B data by manually changing an API id. Authorization is enforced
 * server-side on the record's own scope.
 */
describe("§69 cross-scope IDOR protection", () => {
  const BRAND_A = "brand_A";
  const BRAND_B = "brand_B";
  const KW = "country_KW";
  const AE = "country_AE";
  const DIMS = ["companyId", "brandId", "countryId"] as const;

  // Marketing employee: Brand A, Kuwait only.
  const employee = principal([assignment("marketing_employee", { brandId: BRAND_A, countryId: KW })]);

  it("allows access to a record inside the assigned scope (Brand A / Kuwait)", () => {
    expect(() =>
      assertRecordInScope(employee, "campaigns.view", { companyId: null, brandId: BRAND_A, countryId: KW }, [...DIMS]),
    ).not.toThrow();
  });

  it("BLOCKS Brand A in a different country (UAE)", () => {
    expect(() =>
      assertRecordInScope(employee, "campaigns.view", { companyId: null, brandId: BRAND_A, countryId: AE }, [...DIMS]),
    ).toThrow(ForbiddenError);
  });

  it("BLOCKS a different brand (Brand B) even in the same country", () => {
    expect(() =>
      assertRecordInScope(employee, "campaigns.view", { companyId: null, brandId: BRAND_B, countryId: KW }, [...DIMS]),
    ).toThrow(ForbiddenError);
  });

  it("BLOCKS Brand B in a different country", () => {
    expect(() =>
      assertRecordInScope(employee, "campaigns.view", { companyId: null, brandId: BRAND_B, countryId: AE }, [...DIMS]),
    ).toThrow(ForbiddenError);
  });

  it("a super admin bypasses scope (management full-group visibility)", () => {
    const admin = principal([], { isSuperAdmin: true });
    expect(() =>
      assertRecordInScope(admin, "campaigns.view", { brandId: BRAND_B, countryId: AE }, [...DIMS]),
    ).not.toThrow();
  });

  it("a user without the module permission is blocked regardless of scope", () => {
    // customer_service role has no campaigns.view
    const cs = principal([assignment("customer_service", { brandId: BRAND_A, countryId: KW })]);
    expect(() =>
      assertRecordInScope(cs, "campaigns.view", { brandId: BRAND_A, countryId: KW }, [...DIMS]),
    ).toThrow(ForbiddenError);
  });
});
