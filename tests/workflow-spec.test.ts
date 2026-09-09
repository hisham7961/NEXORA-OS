import { describe, it, expect } from "vitest";
import { validateSpec, parseAndValidate, transitionsFrom, type WorkflowSpec } from "@/lib/workflow/spec";

/**
 * Workflow definition validation (§26–27). Pure graph checks — a definition can
 * never be activated unless it has exactly one start, at least one end, no dead
 * ends, reachable stages, and resolvable permission/role references. These are
 * the guarantees that stop an invalid workflow from governing live records.
 */
const valid: WorkflowSpec = {
  stages: [
    { key: "draft", name: "Draft", category: "neutral", isInitial: true },
    { key: "review", name: "Review", category: "info" },
    { key: "done", name: "Done", category: "success", isTerminal: true },
  ],
  transitions: [
    { key: "submit", name: "Submit", from: "draft", to: "review" },
    { key: "approve", name: "Approve", from: "review", to: "done" },
  ],
};

describe("workflow spec validation", () => {
  it("accepts a well-formed workflow", () => {
    const r = validateSpec(valid);
    expect(r.ok).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it("rejects a workflow with no initial stage", () => {
    const r = validateSpec({ ...valid, stages: valid.stages.map((s) => ({ ...s, isInitial: false })) });
    expect(r.ok).toBe(false);
    expect(r.errors.join(" ")).toMatch(/initial/i);
  });

  it("rejects multiple initial stages", () => {
    const r = validateSpec({ ...valid, stages: valid.stages.map((s, i) => ({ ...s, isInitial: i < 2 })) });
    expect(r.ok).toBe(false);
    expect(r.errors.join(" ")).toMatch(/multiple initial/i);
  });

  it("rejects a workflow with no terminal stage", () => {
    const r = validateSpec({ ...valid, stages: valid.stages.map((s) => ({ ...s, isTerminal: false })) });
    expect(r.ok).toBe(false);
    expect(r.errors.join(" ")).toMatch(/terminal/i);
  });

  it("rejects duplicate stage keys", () => {
    const r = validateSpec({ ...valid, stages: [...valid.stages, { key: "draft", name: "Dupe", category: "neutral" }] });
    expect(r.ok).toBe(false);
    expect(r.errors.join(" ")).toMatch(/duplicate stage/i);
  });

  it("rejects a transition to an unknown stage", () => {
    const r = validateSpec({ ...valid, transitions: [...valid.transitions, { key: "x", name: "X", from: "review", to: "ghost" }] });
    expect(r.ok).toBe(false);
    expect(r.errors.join(" ")).toMatch(/unknown stage/i);
  });

  it("flags a dead-end non-terminal stage", () => {
    const r = validateSpec({
      stages: [
        { key: "start", name: "Start", category: "neutral", isInitial: true },
        { key: "stuck", name: "Stuck", category: "warning" },
        { key: "end", name: "End", category: "success", isTerminal: true },
      ],
      transitions: [{ key: "go", name: "Go", from: "start", to: "end" }],
    });
    expect(r.ok).toBe(false);
    expect(r.errors.join(" ")).toMatch(/dead end/i);
  });

  it("rejects a transition leaving a terminal stage", () => {
    const r = validateSpec({ ...valid, transitions: [...valid.transitions, { key: "back", name: "Back", from: "done", to: "draft" }] });
    expect(r.ok).toBe(false);
    expect(r.errors.join(" ")).toMatch(/terminal/i);
  });

  it("cross-checks permission references when known keys are supplied", () => {
    const r = validateSpec(
      { ...valid, transitions: [{ ...valid.transitions[0], permission: "registrations.fly" }, valid.transitions[1]] },
      { permissions: new Set(["registrations.edit"]), roles: new Set() },
    );
    expect(r.ok).toBe(false);
    expect(r.errors.join(" ")).toMatch(/unknown permission/i);
  });

  it("cross-checks responsible role references", () => {
    const r = validateSpec(
      { ...valid, stages: valid.stages.map((s) => (s.key === "review" ? { ...s, responsibleRoles: ["ghost_role"] } : s)) },
      { permissions: new Set(), roles: new Set(["regulatory_specialist"]) },
    );
    expect(r.ok).toBe(false);
    expect(r.errors.join(" ")).toMatch(/unknown role/i);
  });

  it("parseAndValidate reports malformed JSON as an error, not a throw", () => {
    const { spec, result } = parseAndValidate("{ not json");
    expect(spec).toBeUndefined();
    expect(result.ok).toBe(false);
  });

  it("transitionsFrom excludes transitions out of terminal stages and honors wildcard", () => {
    const spec: WorkflowSpec = {
      stages: [
        { key: "a", name: "A", category: "neutral", isInitial: true },
        { key: "b", name: "B", category: "info" },
        { key: "z", name: "Z", category: "success", isTerminal: true },
      ],
      transitions: [
        { key: "cancel", name: "Cancel", from: "*", to: "z" },
        { key: "go", name: "Go", from: "a", to: "b" },
      ],
    };
    expect(transitionsFrom(spec, "a").map((t) => t.key).sort()).toEqual(["cancel", "go"]);
    expect(transitionsFrom(spec, "z")).toHaveLength(0); // terminal: no outgoing
  });
});
