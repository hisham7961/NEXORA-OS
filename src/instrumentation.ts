/**
 * Next.js instrumentation hook — runs once at server startup (not during build).
 * We use it to fail fast on insecure production configuration (Phase 2, Part B):
 * a missing / placeholder / short session secret, or a missing DATABASE_URL, in
 * production aborts startup with a clear error instead of silently running insecure.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { assertSecureConfig } = await import("@/lib/env");
    assertSecureConfig();
    // Start the in-process job scheduler (§10) so recurring jobs actually run
    // (daily checks, expiry/renewal reminders, publishing recurrence, workflow
    // SLA escalation). Idempotent runners + a single-start guard make this safe.
    const { startScheduler } = await import("@/lib/jobs/scheduler");
    startScheduler();
  }
}
