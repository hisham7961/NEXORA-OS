/**
 * STATUS REGISTRY (§46) — one controlled semantic color system across the whole
 * platform. Every status maps to one of five categories so colors stay readable
 * and consistent in both light and dark themes. DB StatusDefinition rows can
 * extend/override these at runtime (statuses are configurable, §7/§50).
 */
export type StatusCategory = "neutral" | "info" | "success" | "warning" | "critical";

const MAP: Record<string, Record<string, StatusCategory>> = {
  task: {
    backlog: "neutral", todo: "neutral", in_progress: "info", blocked: "critical",
    waiting: "warning", review: "info", completed: "success", cancelled: "neutral",
  },
  campaign: {
    draft: "neutral", planning: "neutral", waiting_creative: "warning", creative_review: "info",
    ready: "info", scheduled: "info", live: "success", monitoring: "info",
    reporting: "info", completed: "success", cancelled: "neutral",
  },
  customer_case: {
    new: "info", assigned: "info", waiting: "warning", in_progress: "info",
    escalated: "critical", resolved: "success", closed: "neutral",
  },
  registration: {
    preparation: "neutral", documents_missing: "warning", ready_submission: "info",
    submitted: "info", authority_review: "info", additional_requirements: "warning",
    samples_requested: "warning", payment_required: "warning", approved: "success",
    rejected: "critical", registered: "success", renewal_required: "warning", expired: "critical",
  },
  design: {
    requested: "neutral", brief_review: "info", assigned: "info", designing: "info",
    internal_review: "info", revision: "warning", waiting_approval: "warning",
    approved: "success", delivered: "success", published: "success", archived: "neutral",
  },
  document: {
    valid: "success", expiring: "warning", expired: "critical",
    renewal_started: "info", replaced: "neutral", archived: "neutral",
  },
  publishing: {
    idea: "neutral", requested: "neutral", copywriting: "info", design: "info",
    review: "info", approved: "info", scheduled: "warning", published: "success",
    failed: "critical", cancelled: "neutral",
  },
  approval: {
    pending: "warning", approved: "success", rejected: "critical", changes: "warning",
  },
  attendance: {
    present: "success", absent: "critical", leave: "info", holiday: "neutral", late: "warning",
  },
  subscription: {
    active: "success", expiring: "warning", expired: "critical", cancelled: "neutral",
  },
  invoice: {
    draft: "neutral", open: "info", paid: "success", overdue: "critical", void: "neutral",
  },
  expense: {
    draft: "neutral", pending: "warning", approved: "success", rejected: "critical", paid: "success",
  },
  generic: {
    active: "success", inactive: "neutral", suspended: "critical", archived: "neutral",
    pending: "warning", done: "success", failed: "critical", running: "info", queued: "neutral",
    success: "success", error: "critical", warning: "warning", info: "info",
  },
};

export function humanize(key: string): string {
  return key
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function statusCategory(module: string, key: string): StatusCategory {
  return MAP[module]?.[key] ?? MAP.generic[key] ?? "neutral";
}

export function statusMeta(module: string, key: string | null | undefined) {
  const k = key ?? "unknown";
  return { key: k, label: humanize(k), category: statusCategory(module, k) };
}

export const PRIORITY_CATEGORY: Record<string, StatusCategory> = {
  low: "neutral",
  normal: "info",
  high: "warning",
  urgent: "critical",
};
