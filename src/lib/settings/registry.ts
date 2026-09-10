/**
 * Typed System Settings registry (§Phase4-6/7/8). The single source of truth for
 * every administrable global setting: type, label, description, validation, default,
 * required permission, and category. The Settings admin UI is generated from this —
 * it is a control plane, not a raw key/value editor. Structured domain configuration
 * that already has a dedicated model (accounting settings, workflow definitions, tax
 * rates, …) is NOT represented here; SystemSetting is for genuinely global toggles.
 *
 * Secrets are NEVER stored in SystemSetting — deployment secrets live in env / a
 * secret manager. A `secret` def is read-only metadata that reports Configured /
 * Not configured from an environment variable, never the value.
 */
export type SettingType = "string" | "number" | "boolean" | "enum" | "text" | "secret";

export interface SettingDef {
  key: string;
  category: string;
  label: string;
  description: string;
  type: SettingType;
  default?: string | number | boolean;
  permission: string; // permission required to edit (view uses settings.view)
  options?: { value: string; label: string }[]; // for enum
  min?: number;
  max?: number;
  envVar?: string; // for secret: the env var whose presence = "configured"
  restartRequired?: boolean;
}

export const SETTING_CATEGORIES = [
  "General", "Localization", "Notifications", "Tasks", "Attendance", "Accounting",
  "Security", "Appearance", "Storage", "Jobs", "Integrations",
] as const;

export const SETTING_DEFS: SettingDef[] = [
  // General
  { key: "general.groupName", category: "General", label: "Group name", description: "Displayed group/organization name.", type: "string", default: "NEXORA Group", permission: "settings.manage" },
  { key: "general.supportEmail", category: "General", label: "Support email", description: "Contact address shown to users for help.", type: "string", default: "", permission: "settings.manage" },
  // Localization
  { key: "localization.defaultLocale", category: "Localization", label: "Default language", description: "Default UI language for new users.", type: "enum", default: "en", options: [{ value: "en", label: "English" }, { value: "ar", label: "العربية" }], permission: "settings.manage" },
  { key: "localization.defaultTimezone", category: "Localization", label: "Default timezone", description: "Default timezone for scheduling and display.", type: "string", default: "Asia/Kuwait", permission: "settings.manage" },
  { key: "localization.defaultCurrency", category: "Localization", label: "Default currency", description: "Default display currency (ISO 4217).", type: "string", default: "KWD", permission: "settings.manage" },
  // Notifications
  { key: "notifications.digestEnabled", category: "Notifications", label: "Daily digest", description: "Send the daily notification digest.", type: "boolean", default: true, permission: "settings.manage" },
  { key: "notifications.certificateExpiryDays", category: "Notifications", label: "Certificate expiry lead (days)", description: "Days before expiry to start certificate reminders.", type: "number", default: 90, min: 1, max: 365, permission: "settings.manage" },
  // Tasks
  { key: "tasks.defaultReminderDays", category: "Tasks", label: "Task reminder lead (days)", description: "Default days before a due task to remind the assignee.", type: "number", default: 1, min: 0, max: 30, permission: "settings.manage" },
  // Attendance
  { key: "attendance.lateThresholdMinutes", category: "Attendance", label: "Late threshold (minutes)", description: "Minutes after expected start counted as late.", type: "number", default: 10, min: 0, max: 120, permission: "settings.manage" },
  // Accounting (global toggles only; per-company config lives in accounting settings)
  { key: "accounting.requireApprovalToPost", category: "Accounting", label: "Require approval to post", description: "If enabled, journals require approval before posting (policy flag).", type: "boolean", default: false, permission: "settings.manage" },
  // Security
  { key: "security.sessionTtlDays", category: "Security", label: "Session lifetime (days)", description: "How long a login session stays valid.", type: "number", default: 30, min: 1, max: 90, permission: "settings.manage", restartRequired: false },
  { key: "security.mfaRequiredForFinance", category: "Security", label: "Require MFA for finance", description: "Require MFA enrollment for users with finance permissions.", type: "boolean", default: false, permission: "settings.manage" },
  { key: "security.mfaRequiredForAdmins", category: "Security", label: "Require MFA for admins", description: "Require MFA for super admins and permission administrators.", type: "boolean", default: false, permission: "settings.manage" },
  // Appearance
  { key: "appearance.defaultTheme", category: "Appearance", label: "Default theme", description: "Default color theme for new users.", type: "enum", default: "system", options: [{ value: "system", label: "System" }, { value: "light", label: "Light" }, { value: "dark", label: "Dark" }], permission: "settings.manage" },
  // Storage (secret / env metadata)
  { key: "storage.driver", category: "Storage", label: "Storage driver", description: "Object storage driver (from environment).", type: "secret", envVar: "NEXORA_STORAGE_DRIVER", permission: "settings.manage" },
  { key: "storage.s3Configured", category: "Storage", label: "S3 credentials", description: "Whether S3-compatible storage is configured.", type: "secret", envVar: "NEXORA_S3_ACCESS_KEY_ID", permission: "settings.manage" },
  // Jobs / Integrations (metadata)
  { key: "jobs.schedulerEnabled", category: "Jobs", label: "In-process scheduler", description: "Whether the in-process scheduler runs (disabled via NEXORA_DISABLE_SCHEDULER).", type: "secret", envVar: "NEXORA_DISABLE_SCHEDULER", permission: "settings.manage" },
  { key: "integrations.ratelimitBackend", category: "Integrations", label: "Rate-limit backend", description: "Distributed rate-limit store (Upstash) configuration.", type: "secret", envVar: "NEXORA_UPSTASH_REDIS_REST_URL", permission: "settings.manage" },
];

export const SETTING_BY_KEY = new Map(SETTING_DEFS.map((d) => [d.key, d]));

/** Coerce + validate a raw string value against a setting def. Returns the value to store (JSON string). Throws a message on invalid input. */
export function coerceSetting(def: SettingDef, raw: unknown): string {
  if (def.type === "secret") throw new Error("This setting is environment-managed and cannot be edited here.");
  if (def.type === "boolean") return JSON.stringify(raw === true || raw === "true");
  if (def.type === "number") {
    const n = Number(raw);
    if (!Number.isFinite(n)) throw new Error("Must be a number.");
    if (def.min != null && n < def.min) throw new Error(`Must be ≥ ${def.min}.`);
    if (def.max != null && n > def.max) throw new Error(`Must be ≤ ${def.max}.`);
    return JSON.stringify(n);
  }
  if (def.type === "enum") {
    const v = String(raw);
    if (!def.options?.some((o) => o.value === v)) throw new Error("Not an allowed value.");
    return JSON.stringify(v);
  }
  // string / text
  const s = String(raw ?? "");
  if (s.length > 2000) throw new Error("Too long.");
  return JSON.stringify(s);
}

/** Decode a stored JSON value (or the default) to a JS value. */
export function decodeSetting(def: SettingDef, stored: string | null | undefined): string | number | boolean {
  if (stored == null) return def.default ?? "";
  try { return JSON.parse(stored) as string | number | boolean; } catch { return def.default ?? ""; }
}
