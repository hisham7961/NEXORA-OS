import { describe, it, expect } from "vitest";
import { can, assertRecordInScope, ForbiddenError } from "@/lib/permissions/engine";
import { assignment, customAssignment, principal } from "./helpers";

/**
 * Phase 2, Part Z — critical mutation-authorization cases. These assert the
 * server-side checks every write path runs (create/edit/status/approve) refuse
 * actions outside the caller's scope. Pure (no DB) so they run in CI.
 */
const DIMS = ["companyId", "brandId", "countryId"] as const;
const A = "brand_A", B = "brand_B", KW = "country_KW", AE = "country_AE";

// Marketing employee: Brand A, Kuwait only.
const employee = principal([assignment("marketing_employee", { brandId: A, countryId: KW })]);

describe("create outside authorized scope → denied", () => {
  it("allows create inside scope", () => {
    expect(can(employee, "tasks.create", { brandId: A, countryId: KW })).toBe(true);
  });
  it("denies create in another country of the same brand", () => {
    expect(can(employee, "tasks.create", { brandId: A, countryId: AE })).toBe(false);
  });
  it("denies create in another brand", () => {
    expect(can(employee, "tasks.create", { brandId: B, countryId: KW })).toBe(false);
  });
});

describe("edit / status mutation outside scope → denied (IDOR on the record)", () => {
  it("allows editing an in-scope record", () => {
    expect(() => assertRecordInScope(employee, "tasks.edit", { brandId: A, countryId: KW }, [...DIMS])).not.toThrow();
  });
  it("blocks editing a record in another country", () => {
    expect(() => assertRecordInScope(employee, "tasks.edit", { brandId: A, countryId: AE }, [...DIMS])).toThrow(ForbiddenError);
  });
  it("blocks a cross-brand status mutation", () => {
    expect(() => assertRecordInScope(employee, "tasks.edit", { brandId: B, countryId: KW }, [...DIMS])).toThrow(ForbiddenError);
  });
});

describe("approval / privileged actions by unauthorized user → denied", () => {
  it("a marketing employee cannot approve", () => {
    expect(can(employee, "approvals.approve", { brandId: A, countryId: KW })).toBe(false);
  });
  it("a marketing manager (scoped) can approve within scope but not outside", () => {
    const mgr = principal([assignment("marketing_manager", { brandId: A, countryId: KW })]);
    expect(can(mgr, "approvals.approve", { brandId: A, countryId: KW })).toBe(true);
    expect(can(mgr, "approvals.approve", { brandId: B, countryId: KW })).toBe(false);
  });
});

describe("cross-brand customer/regulatory mutation IDOR → denied", () => {
  const cs = principal([assignment("customer_service", { brandId: A, countryId: KW })]);
  it("customer-service edit blocked on another brand's case", () => {
    expect(() => assertRecordInScope(cs, "cases.edit", { brandId: B, countryId: KW }, [...DIMS])).toThrow(ForbiddenError);
  });
  const reg = principal([assignment("regulatory_specialist", { brandId: A })]);
  it("regulatory edit blocked on another brand's registration", () => {
    expect(() => assertRecordInScope(reg, "registrations.edit", { brandId: B, countryId: KW }, [...DIMS])).toThrow(ForbiddenError);
  });
});

describe("campaign write path scope (Part K)", () => {
  // Marketing manager scoped to Brand A in Kuwait + UAE (combined dims).
  const mgr = principal([
    assignment("marketing_manager", { brandId: A, countryId: KW }),
    assignment("marketing_manager", { brandId: A, countryId: AE }),
  ]);
  it("can create a campaign inside either granted country", () => {
    expect(can(mgr, "campaigns.create", { brandId: A, countryId: KW })).toBe(true);
    expect(can(mgr, "campaigns.create", { brandId: A, countryId: AE })).toBe(true);
  });
  it("cannot create in the same brand but an ungranted country", () => {
    expect(can(mgr, "campaigns.create", { brandId: A, countryId: "country_SA" })).toBe(false);
  });
  it("cannot create in another brand", () => {
    expect(can(mgr, "campaigns.create", { brandId: B, countryId: KW })).toBe(false);
  });
  it("blocks editing (IDOR) a campaign outside the granted scope", () => {
    expect(() => assertRecordInScope(mgr, "campaigns.edit", { brandId: A, countryId: KW }, [...DIMS])).not.toThrow();
    expect(() => assertRecordInScope(mgr, "campaigns.edit", { brandId: B, countryId: KW }, [...DIMS])).toThrow(ForbiddenError);
    expect(() => assertRecordInScope(mgr, "campaigns.edit", { brandId: A, countryId: "country_SA" }, [...DIMS])).toThrow(ForbiddenError);
  });
});

describe("store performance entry scope (Part P)", () => {
  // A commerce analyst able to record sales in Brand A / Kuwait only.
  const analyst = principal([customAssignment(["sales.view", "sales.create", "stores.view"], { brandId: A, countryId: KW })]);
  it("can record performance for an in-scope store", () => {
    expect(can(analyst, "sales.create", { brandId: A, countryId: KW })).toBe(true);
    expect(() => assertRecordInScope(analyst, "sales.create", { brandId: A, countryId: KW }, [...DIMS])).not.toThrow();
  });
  it("cannot record performance for a store in another brand (IDOR)", () => {
    expect(() => assertRecordInScope(analyst, "sales.create", { brandId: B, countryId: KW }, [...DIMS])).toThrow(ForbiddenError);
  });
  it("cannot record performance for a store in another country", () => {
    expect(() => assertRecordInScope(analyst, "sales.create", { brandId: A, countryId: AE }, [...DIMS])).toThrow(ForbiddenError);
  });
});

describe("social publishing scope (Part L/M)", () => {
  // Marketing employee can plan/publish in Brand A / Kuwait only.
  const emp = principal([assignment("marketing_employee", { brandId: A, countryId: KW })]);
  it("can create a publishing item inside scope", () => {
    expect(can(emp, "social.create", { brandId: A, countryId: KW })).toBe(true);
  });
  it("cannot create in another brand", () => {
    expect(can(emp, "social.create", { brandId: B, countryId: KW })).toBe(false);
  });
  it("blocks editing (IDOR) a publishing item outside scope", () => {
    expect(() => assertRecordInScope(emp, "social.edit", { brandId: A, countryId: KW }, ["brandId", "countryId"])).not.toThrow();
    expect(() => assertRecordInScope(emp, "social.edit", { brandId: B, countryId: KW }, ["brandId", "countryId"])).toThrow(ForbiddenError);
  });
});

describe("whatsapp workflow scope + approval (Part N)", () => {
  const employee2 = principal([assignment("marketing_employee", { brandId: A, countryId: KW })]);
  const manager = principal([assignment("marketing_manager", { brandId: A, countryId: KW })]);
  it("an employee can create/edit but cannot approve", () => {
    expect(can(employee2, "whatsapp.create", { brandId: A, countryId: KW })).toBe(true);
    expect(can(employee2, "whatsapp.approve", { brandId: A, countryId: KW })).toBe(false);
  });
  it("a manager can approve within scope only", () => {
    expect(can(manager, "whatsapp.approve", { brandId: A, countryId: KW })).toBe(true);
    expect(can(manager, "whatsapp.approve", { brandId: B, countryId: KW })).toBe(false);
  });
  it("blocks editing (IDOR) a campaign outside scope", () => {
    expect(() => assertRecordInScope(manager, "whatsapp.edit", { brandId: B, countryId: KW }, ["brandId", "countryId"])).toThrow(ForbiddenError);
  });
});

describe("creative request + version approval scope (Part O)", () => {
  const employee3 = principal([assignment("marketing_employee", { brandId: A, countryId: KW })]);
  const manager = principal([assignment("marketing_manager", { brandId: A, countryId: KW })]);
  it("an employee can create/edit a request but cannot approve a version", () => {
    expect(can(employee3, "design.create", { brandId: A, countryId: KW })).toBe(true);
    expect(can(employee3, "design.approve", { brandId: A, countryId: KW })).toBe(false);
  });
  it("a manager can approve a version within scope only", () => {
    expect(can(manager, "design.approve", { brandId: A, countryId: KW })).toBe(true);
    expect(can(manager, "design.approve", { brandId: B, countryId: KW })).toBe(false);
  });
  it("blocks editing (IDOR) a request outside scope", () => {
    expect(() => assertRecordInScope(manager, "design.edit", { brandId: B, countryId: KW }, [...DIMS])).toThrow(ForbiddenError);
  });
});

describe("discussions channel scope (Part §9)", () => {
  const employee4 = principal([customAssignment(["discussions.view", "discussions.create"], { brandId: A, countryId: KW })]);
  it("can create a channel inside scope", () => {
    expect(can(employee4, "discussions.create", { brandId: A, countryId: KW })).toBe(true);
  });
  it("cannot create a channel in another brand's scope", () => {
    expect(can(employee4, "discussions.create", { brandId: B, countryId: KW })).toBe(false);
  });
  it("a public channel out of scope is not viewable (IDOR)", () => {
    expect(() => assertRecordInScope(employee4, "discussions.view", { brandId: A, countryId: KW }, [...DIMS])).not.toThrow();
    expect(() => assertRecordInScope(employee4, "discussions.view", { brandId: B, countryId: KW }, [...DIMS])).toThrow(ForbiddenError);
  });
});
