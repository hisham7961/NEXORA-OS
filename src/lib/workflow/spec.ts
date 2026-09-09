/**
 * WORKFLOW SPEC + VALIDATION (§26–27, §50)
 * ----------------------------------------------------------------------------
 * Pure, framework-free declarative workflow model. Kept dependency-light (only
 * zod for structural parsing) so it is trivially unit-testable — the same
 * philosophy as the permission engine. A WorkflowVersion stores one of these
 * specs as JSON text; the engine validates it BEFORE a version can be activated
 * so an invalid definition can never govern live records.
 *
 * The five status categories match `src/lib/status.ts` / <StatusBadge/>.
 */

import { z } from "zod";

export const STAGE_CATEGORIES = ["neutral", "info", "success", "warning", "critical"] as const;
export type StageCategory = (typeof STAGE_CATEGORIES)[number];

const keyRe = /^[a-z0-9][a-z0-9_]*$/; // stable machine keys: lower snake

export const escalationSchema = z.object({
  afterHours: z.number().positive().max(24 * 365),
  toRoles: z.array(z.string()).optional(),
  note: z.string().max(300).optional(),
});

export const stageSchema = z.object({
  key: z.string().regex(keyRe, "stage key must be lower_snake_case"),
  name: z.string().trim().min(1).max(80),
  category: z.enum(STAGE_CATEGORIES).default("neutral"),
  isInitial: z.boolean().optional(),
  isTerminal: z.boolean().optional(),
  slaHours: z.number().positive().max(24 * 365).optional(),
  responsibleRoles: z.array(z.string()).optional(),
  requiredFields: z.array(z.string()).optional(),
  requiredDocuments: z.array(z.string()).optional(),
  requiredApprovals: z.number().int().min(0).max(20).optional(),
  escalation: escalationSchema.optional(),
});

export const transitionSchema = z.object({
  key: z.string().regex(keyRe, "transition key must be lower_snake_case"),
  name: z.string().trim().min(1).max(80),
  from: z.string(), // stage key or "*" (any non-terminal stage)
  to: z.string(), // stage key
  permission: z.string().optional(), // a permission key required to perform
  requiresApproval: z.boolean().optional(),
});

export const workflowSpecSchema = z.object({
  stages: z.array(stageSchema).min(1, "a workflow needs at least one stage"),
  transitions: z.array(transitionSchema).default([]),
});

export type WorkflowStageSpec = z.infer<typeof stageSchema>;
export type WorkflowTransitionSpec = z.infer<typeof transitionSchema>;
export type WorkflowSpec = z.infer<typeof workflowSpecSchema>;

export interface ValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

/** Known keys the validator can cross-check references against (optional). */
export interface KnownRefs {
  permissions?: Set<string>;
  roles?: Set<string>;
}

/** Parse untrusted JSON/text into a spec (throws ZodError on malformed shape). */
export function parseSpec(raw: unknown): WorkflowSpec {
  const value = typeof raw === "string" ? JSON.parse(raw) : raw;
  return workflowSpecSchema.parse(value);
}

export function initialStage(spec: WorkflowSpec): WorkflowStageSpec | undefined {
  return spec.stages.find((s) => s.isInitial);
}

export function terminalStages(spec: WorkflowSpec): WorkflowStageSpec[] {
  return spec.stages.filter((s) => s.isTerminal);
}

export function stageByKey(spec: WorkflowSpec, key: string): WorkflowStageSpec | undefined {
  return spec.stages.find((s) => s.key === key);
}

/** Transitions available FROM a stage (respecting `*` wildcard, excluding terminal). */
export function transitionsFrom(spec: WorkflowSpec, stageKey: string): WorkflowTransitionSpec[] {
  const stage = stageByKey(spec, stageKey);
  if (!stage || stage.isTerminal) return [];
  return spec.transitions.filter((tr) => tr.from === stageKey || tr.from === "*");
}

/**
 * Full semantic validation. Structural shape is assumed already valid (via
 * `parseSpec`); this checks the graph and cross-references. `known` lets the
 * caller assert permission/role references resolve against the live catalog.
 */
export function validateSpec(spec: WorkflowSpec, known: KnownRefs = {}): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // --- Stage keys unique ---
  const seen = new Set<string>();
  for (const s of spec.stages) {
    if (seen.has(s.key)) errors.push(`Duplicate stage key "${s.key}".`);
    seen.add(s.key);
  }
  const stageKeys = seen;

  // --- Exactly one initial stage ---
  const initials = spec.stages.filter((s) => s.isInitial);
  if (initials.length === 0) errors.push("No initial stage — mark exactly one stage as the start.");
  if (initials.length > 1) errors.push(`Multiple initial stages (${initials.map((s) => s.key).join(", ")}); only one is allowed.`);

  // --- At least one terminal stage ---
  const terminals = spec.stages.filter((s) => s.isTerminal);
  if (terminals.length === 0) errors.push("No terminal stage — mark at least one stage as an end state.");

  // A stage cannot be both initial and terminal in a meaningful workflow.
  for (const s of spec.stages) {
    if (s.isInitial && s.isTerminal) warnings.push(`Stage "${s.key}" is both initial and terminal — the workflow completes immediately.`);
  }

  // --- Transition integrity ---
  const trKeys = new Set<string>();
  for (const tr of spec.transitions) {
    if (trKeys.has(tr.key)) errors.push(`Duplicate transition key "${tr.key}".`);
    trKeys.add(tr.key);
    if (tr.from !== "*" && !stageKeys.has(tr.from)) errors.push(`Transition "${tr.key}" starts from unknown stage "${tr.from}".`);
    if (tr.to === "*") errors.push(`Transition "${tr.key}" targets "*", which is not a stage.`);
    else if (!stageKeys.has(tr.to)) errors.push(`Transition "${tr.key}" targets unknown stage "${tr.to}".`);
    // A transition must not originate from a terminal stage.
    if (tr.from !== "*") {
      const fromStage = spec.stages.find((s) => s.key === tr.from);
      if (fromStage?.isTerminal) errors.push(`Transition "${tr.key}" leaves terminal stage "${tr.from}".`);
    }
    // Permission reference check.
    if (tr.permission && known.permissions && !known.permissions.has(tr.permission)) {
      errors.push(`Transition "${tr.key}" requires unknown permission "${tr.permission}".`);
    }
  }

  // --- Role reference checks (stages) ---
  if (known.roles) {
    for (const s of spec.stages) {
      for (const r of s.responsibleRoles ?? []) {
        if (!known.roles.has(r)) errors.push(`Stage "${s.key}" references unknown role "${r}".`);
      }
      for (const r of s.escalation?.toRoles ?? []) {
        if (!known.roles.has(r)) errors.push(`Stage "${s.key}" escalates to unknown role "${r}".`);
      }
    }
  }

  // --- Reachability + dead-ends (only meaningful once graph is well-formed) ---
  if (errors.length === 0 && initials.length === 1) {
    const start = initials[0].key;
    // BFS forward reachability.
    const reachable = new Set<string>([start]);
    const queue = [start];
    while (queue.length) {
      const cur = queue.shift()!;
      for (const tr of transitionsFrom(spec, cur)) {
        if (!reachable.has(tr.to)) {
          reachable.add(tr.to);
          queue.push(tr.to);
        }
      }
    }
    for (const s of spec.stages) {
      if (!reachable.has(s.key)) warnings.push(`Stage "${s.key}" is unreachable from the start.`);
      if (!s.isTerminal && transitionsFrom(spec, s.key).length === 0) errors.push(`Stage "${s.key}" is a dead end — no outgoing transition and not terminal.`);
    }
    // Every reachable non-terminal must be able to reach a terminal.
    const canReachTerminal = (from: string): boolean => {
      const visited = new Set<string>([from]);
      const q = [from];
      while (q.length) {
        const cur = q.shift()!;
        const st = spec.stages.find((s) => s.key === cur);
        if (st?.isTerminal) return true;
        for (const tr of transitionsFrom(spec, cur)) {
          if (!visited.has(tr.to)) {
            visited.add(tr.to);
            q.push(tr.to);
          }
        }
      }
      return false;
    };
    if (!canReachTerminal(start)) errors.push("The start stage cannot reach any terminal stage.");
  }

  return { ok: errors.length === 0, errors, warnings };
}

/** Convenience: parse + validate in one step. Returns errors if the shape itself is bad. */
export function parseAndValidate(raw: unknown, known: KnownRefs = {}): { spec?: WorkflowSpec; result: ValidationResult } {
  let spec: WorkflowSpec;
  try {
    spec = parseSpec(raw);
  } catch (e) {
    const msg = e instanceof z.ZodError ? e.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") : "Invalid workflow JSON.";
    return { result: { ok: false, errors: [msg], warnings: [] } };
  }
  return { spec, result: validateSpec(spec, known) };
}
