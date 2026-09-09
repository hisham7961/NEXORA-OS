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

describe("approved answers approval gate (Part §13-17)", () => {
  // An agent can view/create/edit but not approve; a manager can approve in scope.
  const agent = principal([customAssignment(["answers.view", "answers.create", "answers.edit"], { brandId: A })]);
  const manager = principal([customAssignment(["answers.view", "answers.approve", "answers.manage"], { brandId: A })]);
  it("an agent cannot approve answers", () => {
    expect(can(agent, "answers.approve", { brandId: A })).toBe(false);
  });
  it("a manager approves only within brand scope", () => {
    expect(can(manager, "answers.approve", { brandId: A })).toBe(true);
    expect(can(manager, "answers.approve", { brandId: B })).toBe(false);
  });
});

describe("subscriptions finance-value scope (Part §23-24)", () => {
  const finance = principal([customAssignment(["subscriptions.view", "subscriptions.create", "subscriptions.edit"], { companyId: "co_A" })]);
  const DIMS3 = ["companyId", "brandId", "countryId"] as const;
  it("can manage subscriptions inside its company", () => {
    expect(can(finance, "subscriptions.create", { companyId: "co_A" })).toBe(true);
    expect(() => assertRecordInScope(finance, "subscriptions.edit", { companyId: "co_A", brandId: null, countryId: null }, [...DIMS3])).not.toThrow();
  });
  it("cannot edit a subscription in another company (IDOR)", () => {
    expect(() => assertRecordInScope(finance, "subscriptions.edit", { companyId: "co_B", brandId: null, countryId: null }, [...DIMS3])).toThrow(ForbiddenError);
  });
  it("finance value visibility is gated by finance.view_values", () => {
    expect(can(finance, "finance.view_values", { companyId: "co_A" })).toBe(false);
  });
});

describe("workflow engine authoring + instance scope (Part §26-27)", () => {
  // Workflow authoring is gated by the `workflows` module. An operator with only
  // module-level view cannot author; a workflow admin can, but only in scope.
  const viewer = principal([customAssignment(["workflows.view"], { companyId: "co_A" })]);
  const admin = principal([customAssignment(["workflows.view", "workflows.create", "workflows.edit", "workflows.manage"], { companyId: "co_A" })]);
  const DIMS3 = ["companyId", "brandId", "countryId"] as const;

  it("a viewer cannot create or edit workflows", () => {
    expect(can(viewer, "workflows.create", { companyId: "co_A" })).toBe(false);
    expect(can(viewer, "workflows.edit", { companyId: "co_A" })).toBe(false);
  });
  it("a workflow admin authors only within its company scope", () => {
    expect(can(admin, "workflows.create", { companyId: "co_A" })).toBe(true);
    expect(can(admin, "workflows.create", { companyId: "co_B" })).toBe(false);
  });
  it("blocks editing (IDOR) a workflow definition in another company", () => {
    expect(() => assertRecordInScope(admin, "workflows.edit", { companyId: "co_A", brandId: null, countryId: null }, [...DIMS3])).not.toThrow();
    expect(() => assertRecordInScope(admin, "workflows.edit", { companyId: "co_B", brandId: null, countryId: null }, [...DIMS3])).toThrow(ForbiddenError);
  });
  it("a transition's declared permission is enforced in the record's scope", () => {
    // A regulatory specialist in Brand A may perform a registrations.edit transition
    // on a Brand-A record, but not on another brand's record (transition IDOR).
    const reg = principal([assignment("regulatory_specialist", { brandId: A })]);
    expect(() => assertRecordInScope(reg, "registrations.edit", { companyId: null, brandId: A, countryId: KW }, [...DIMS3])).not.toThrow();
    expect(() => assertRecordInScope(reg, "registrations.edit", { companyId: null, brandId: B, countryId: KW }, [...DIMS3])).toThrow(ForbiddenError);
  });
  it("workflow instance visibility is scoped to the governed record (IDOR)", () => {
    expect(() => assertRecordInScope(viewer, "workflows.view", { companyId: "co_A", brandId: null, countryId: null }, [...DIMS3])).not.toThrow();
    expect(() => assertRecordInScope(viewer, "workflows.view", { companyId: "co_B", brandId: null, countryId: null }, [...DIMS3])).toThrow(ForbiddenError);
  });
});

describe("attendance correction approval gate (Part §25)", () => {
  const employee5 = principal([customAssignment(["attendance.view"], {})]);
  const manager = principal([customAssignment(["attendance.view", "attendance.manage"], {})]);
  it("an employee cannot approve corrections", () => {
    expect(can(employee5, "attendance.manage")).toBe(false);
  });
  it("a manager can approve corrections", () => {
    expect(can(manager, "attendance.manage")).toBe(true);
  });
});
