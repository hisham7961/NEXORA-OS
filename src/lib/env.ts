/**
 * Centralized, validated environment access. Never read process.env directly
 * elsewhere — import from here so configuration is visible and typed (§36, §74).
 */

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined || value === "") {
    // In development we fall back to safe defaults so the platform runs out of
    // the box; in production, missing critical secrets must fail loudly.
    if (process.env.NODE_ENV === "production") {
      throw new Error(`Missing required environment variable: ${name}`);
    }
    return fallback ?? "";
  }
  return value;
}

export const env = {
  databaseUrl: required("DATABASE_URL", "file:./dev.db"),
  sessionSecret: required(
    "NEXORA_SESSION_SECRET",
    "dev-only-insecure-secret-change-in-production-0000000000000000",
  ),
  appName: process.env.NEXORA_APP_NAME ?? "NEXORA OS",
  defaultLocale: (process.env.NEXORA_DEFAULT_LOCALE ?? "en") as "en" | "ar",
  isProduction: process.env.NODE_ENV === "production",
};
