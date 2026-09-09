/**
 * Centralized, validated environment access. Never read process.env directly
 * elsewhere — import from here so configuration is visible and typed (§36, §74).
 *
 * IMPORTANT: this module must not throw at import time (that would break
 * `next build`, which evaluates modules with NODE_ENV=production). Insecure-config
 * enforcement happens at real server startup via `assertSecureConfig()`, called
 * from `src/instrumentation.ts` (Phase 2, Part B).
 */

const isProduction = process.env.NODE_ENV === "production";

const DEV_SESSION_SECRET = "dev-only-insecure-secret-change-in-production-0000000000000000";

/** Known development placeholders that must never be accepted in production. */
const INSECURE_SECRETS = new Set([
  DEV_SESSION_SECRET,
  "replace-with-a-long-random-secret",
  "replace-with-a-long-random-secret-at-least-32-chars",
  "changeme",
  "secret",
  "",
]);

export function isInsecureSecret(value: string | undefined): boolean {
  return !value || INSECURE_SECRETS.has(value) || value.length < 32;
}

export const env = {
  databaseUrl: process.env.DATABASE_URL ?? "postgresql://nexora:nexora@localhost:5432/nexora?schema=public",
  sessionSecret: process.env.NEXORA_SESSION_SECRET || DEV_SESSION_SECRET,
  appName: process.env.NEXORA_APP_NAME ?? "NEXORA OS",
  defaultLocale: (process.env.NEXORA_DEFAULT_LOCALE ?? "en") as "en" | "ar",
  isProduction,
};

/**
 * Fail fast on insecure production configuration. Called once at server startup.
 * Throws with a clear, actionable message; never called during build.
 */
export function assertSecureConfig(): void {
  if (!isProduction) return;
  const problems: string[] = [];
  if (isInsecureSecret(process.env.NEXORA_SESSION_SECRET)) {
    problems.push(
      "NEXORA_SESSION_SECRET is missing, a known development placeholder, or shorter than 32 chars. " +
        'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"',
    );
  }
  if (!process.env.DATABASE_URL) {
    problems.push("DATABASE_URL is required in production (a PostgreSQL connection string).");
  }
  if (problems.length) {
    throw new Error("FATAL CONFIG:\n - " + problems.join("\n - "));
  }
}
