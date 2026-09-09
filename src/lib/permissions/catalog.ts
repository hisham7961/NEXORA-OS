/**
 * PERMISSION CATALOG (§3)
 * ----------------------------------------------------------------------------
 * The single source of truth for every permission the platform enforces. The
 * Admin Permission Matrix, the Permission Tester, seeded roles and server-side
 * checks all derive from this catalog — nothing is enforced that isn't listed
 * here, and nothing here is unenforceable (no hidden systems, §74).
 *
 * A permission key is `<module>.<action>`. `manage` implies the standard CRUD
 * actions for that module (see impliedBy in the engine).
 */

export const ACTIONS = [
  "view",
  "create",
  "edit",
  "delete",
  "approve",
  "export",
  "manage",
] as const;
export type Action = (typeof ACTIONS)[number];

/** Cross-cutting sensitive capabilities (§3). */
export const SPECIAL_PERMISSIONS = [
  "finance.view_values", // view financial values
  "files.view_restricted", // view restricted documents
  "settings.manage", // manage settings
  "permissions.manage", // change roles/permissions (audited)
  "audit.view", // read the audit explorer
  "impersonate.preview", // permission tester "view as user"
] as const;

/**
 * Modules map 1:1 to the navigation areas (§4). `scopes` declares which scope
 * dimensions are meaningful for a module's records — used to fail-closed when an
 * assignment restricts a dimension a module doesn't support.
 */
export interface ModuleDef {
  key: string;
  label: string;
  group: string;
  /** Which of the standard actions this module exposes. */
  actions: Action[];
}

export const MODULES: ModuleDef[] = [
  // Work
  { key: "tasks", label: "Tasks", group: "Work", actions: ["view", "create", "edit", "delete", "manage"] },
  { key: "projects", label: "Projects", group: "Work", actions: ["view", "create", "edit", "delete", "manage"] },
  { key: "approvals", label: "Approvals", group: "Work", actions: ["view", "approve", "manage"] },
  { key: "daily_checks", label: "Daily Checks", group: "Work", actions: ["view", "create", "edit", "manage"] },
  { key: "attendance", label: "Attendance", group: "Work", actions: ["view", "edit", "manage", "export"] },
  // Marketing
  { key: "campaigns", label: "Campaigns", group: "Marketing", actions: ["view", "create", "edit", "delete", "approve", "export", "manage"] },
  { key: "social", label: "Social Publishing", group: "Marketing", actions: ["view", "create", "edit", "delete", "manage"] },
  { key: "whatsapp", label: "WhatsApp Campaigns", group: "Marketing", actions: ["view", "create", "edit", "approve", "manage"] },
  // Creative
  { key: "design", label: "Design Requests", group: "Creative", actions: ["view", "create", "edit", "approve", "manage"] },
  { key: "creative_library", label: "Creative Library", group: "Creative", actions: ["view", "create", "edit", "manage"] },
  // Commerce
  { key: "stores", label: "Stores", group: "Commerce", actions: ["view", "create", "edit", "delete", "manage"] },
  { key: "sales", label: "Sales", group: "Commerce", actions: ["view", "create", "edit", "export", "manage"] },
  { key: "products", label: "Products", group: "Commerce", actions: ["view", "create", "edit", "delete", "manage"] },
  // Regulatory
  { key: "registrations", label: "Registrations", group: "Regulatory", actions: ["view", "create", "edit", "delete", "manage"] },
  { key: "documents", label: "Documents", group: "Regulatory", actions: ["view", "create", "edit", "delete", "manage"] },
  // Customer Service
  { key: "cases", label: "Customer Cases", group: "Customer Service", actions: ["view", "create", "edit", "manage"] },
  { key: "answers", label: "Approved Answers", group: "Customer Service", actions: ["view", "create", "edit", "approve", "manage"] },
  // Organization
  { key: "companies", label: "Companies", group: "Organization", actions: ["view", "create", "edit", "delete", "manage"] },
  { key: "brands", label: "Brands", group: "Organization", actions: ["view", "create", "edit", "delete", "manage"] },
  { key: "markets", label: "Markets", group: "Organization", actions: ["view", "create", "edit", "manage"] },
  { key: "teams", label: "Teams", group: "Organization", actions: ["view", "create", "edit", "delete", "manage"] },
  { key: "employees", label: "Employees", group: "Organization", actions: ["view", "create", "edit", "delete", "manage"] },
  // Knowledge & Communication
  { key: "knowledge", label: "Knowledge Base", group: "Knowledge", actions: ["view", "create", "edit", "approve", "manage"] },
  { key: "files", label: "Files", group: "Knowledge", actions: ["view", "create", "edit", "delete", "manage"] },
  { key: "discussions", label: "Discussions", group: "Communication", actions: ["view", "create", "edit", "manage"] },
  // Finance
  { key: "finance", label: "Finance", group: "Finance", actions: ["view", "create", "edit", "approve", "export", "manage"] },
  { key: "expenses", label: "Expenses", group: "Finance", actions: ["view", "create", "edit", "approve", "manage"] },
  { key: "subscriptions", label: "Subscriptions", group: "Finance", actions: ["view", "create", "edit", "manage"] },
  // Management intelligence
  { key: "analytics", label: "Analytics", group: "Intelligence", actions: ["view", "export"] },
  { key: "reports", label: "Reports", group: "Intelligence", actions: ["view", "create", "edit", "export", "manage"] },
  // Administration
  { key: "users", label: "Users", group: "Administration", actions: ["view", "create", "edit", "delete", "manage"] },
  { key: "settings", label: "Settings", group: "Administration", actions: ["view", "manage"] },
  { key: "developer", label: "Developer Portal", group: "Administration", actions: ["view", "manage"] },
];

export const SCOPE_DIMENSIONS = ["companyId", "brandId", "countryId", "departmentId", "teamId"] as const;
export type ScopeDimension = (typeof SCOPE_DIMENSIONS)[number];

/** Every enforceable permission key. */
export function allPermissionKeys(): string[] {
  const keys: string[] = [];
  for (const m of MODULES) {
    for (const a of m.actions) keys.push(`${m.key}.${a}`);
  }
  return [...keys, ...SPECIAL_PERMISSIONS];
}

export function moduleForPermission(key: string): string {
  return key.split(".")[0];
}

// ---------------------------------------------------------------------------
// DEFAULT ROLES (seeded; editable in the admin UI — roles are configurable)
// ---------------------------------------------------------------------------

export interface RoleDef {
  key: string;
  name: string;
  description: string;
  isSystem: boolean;
  /** Permission keys. `*` means "all standard actions across every module". */
  permissions: string[];
}

function moduleActions(moduleKeys: string[], actions: Action[]): string[] {
  const out: string[] = [];
  for (const mk of moduleKeys) {
    const mod = MODULES.find((m) => m.key === mk);
    if (!mod) continue;
    for (const a of actions) if (mod.actions.includes(a)) out.push(`${mk}.${a}`);
  }
  return out;
}

const ALL_MODULE_KEYS = MODULES.map((m) => m.key);

export const DEFAULT_ROLES: RoleDef[] = [
  {
    key: "super_admin",
    name: "Super Administrator",
    description: "Unrestricted access to the entire platform (§3).",
    isSystem: true,
    permissions: ["*", ...SPECIAL_PERMISSIONS],
  },
  {
    key: "group_management",
    name: "Group Management",
    description: "Full-group visibility across all brands and modules; can be scoped or global.",
    isSystem: true,
    permissions: [
      ...moduleActions(ALL_MODULE_KEYS, ["view", "export"]),
      "analytics.view",
      "reports.view",
      "audit.view",
      "finance.view_values",
      "approvals.approve",
    ],
  },
  {
    key: "marketing_manager",
    name: "Marketing Manager",
    description: "Manages campaigns, social publishing and WhatsApp within scope.",
    isSystem: true,
    permissions: [
      ...moduleActions(["campaigns", "social", "whatsapp", "design"], ["view", "create", "edit", "approve", "export"]),
      ...moduleActions(["reports", "analytics", "products", "stores"], ["view"]),
      "tasks.view", "tasks.create", "tasks.edit",
      "approvals.view", "approvals.approve",
    ],
  },
  {
    key: "marketing_employee",
    name: "Marketing Employee",
    description: "Executes campaigns and social publishing within scope.",
    isSystem: true,
    permissions: [
      ...moduleActions(["campaigns", "social", "whatsapp"], ["view", "create", "edit"]),
      "design.view", "design.create",
      "tasks.view", "tasks.create", "tasks.edit",
      "daily_checks.view",
    ],
  },
  {
    key: "designer",
    name: "Designer",
    description: "Handles design requests and the creative library.",
    isSystem: true,
    permissions: [
      ...moduleActions(["design", "creative_library"], ["view", "create", "edit"]),
      "tasks.view", "tasks.edit", "files.view", "files.create",
    ],
  },
  {
    key: "regulatory_specialist",
    name: "Regulatory Specialist",
    description: "Manages registrations, certificates and documents.",
    isSystem: true,
    permissions: [
      ...moduleActions(["registrations", "documents"], ["view", "create", "edit"]),
      "products.view", "files.view", "files.create", "tasks.view", "tasks.create", "tasks.edit",
    ],
  },
  {
    key: "customer_service",
    name: "Customer Service Agent",
    description: "Handles customer cases and uses approved answers.",
    isSystem: true,
    permissions: [
      ...moduleActions(["cases"], ["view", "create", "edit"]),
      "answers.view", "products.view", "tasks.view", "daily_checks.view",
    ],
  },
  {
    key: "finance_manager",
    name: "Finance Manager",
    description: "Full finance, accounting, expenses and subscriptions.",
    isSystem: true,
    permissions: [
      ...moduleActions(["finance", "expenses", "subscriptions"], ["view", "create", "edit", "approve", "export"]),
      "finance.view_values", "reports.view", "reports.export", "analytics.view",
      "approvals.view", "approvals.approve",
    ],
  },
  {
    key: "employee",
    name: "Employee",
    description: "Baseline access: My Day, tasks, daily checks, attendance, discussions.",
    isSystem: true,
    permissions: [
      "tasks.view", "tasks.create", "tasks.edit",
      "daily_checks.view", "attendance.view",
      "discussions.view", "discussions.create",
      "knowledge.view", "files.view",
    ],
  },
];
