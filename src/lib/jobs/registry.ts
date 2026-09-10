import { generateDailyChecks } from "@/domain/daily-checks";
import { generateSubscriptionReminders } from "@/domain/subscriptions";
import { generateRecurringPublishing } from "@/domain/social";
import { backfillCampaignSpend } from "@/domain/campaigns";
import { escalateOverdueInstances } from "@/domain/workflows";
import { generateCertificateReminders } from "@/domain/documents";
import { purgeStaleSessions } from "@/domain/sessions";
import { runStorageIntegrityScan } from "@/domain/storage-integrity";
import { deliverPendingWebhooks } from "@/domain/webhooks";

/**
 * The single source of truth for scheduled jobs (§10). The scheduler (and the
 * Admin Operations Center "Run now") drive jobs exclusively through this list, so
 * a job's schedule, permission and runner are declared once. Every runner is
 * idempotent — running it twice for the same period is a no-op.
 */
export interface JobDefinition {
  name: string; // stable name; matches BackgroundJob.name
  cron: string; // 5-field, server-local time
  description: string;
  permission: string; // permission required to trigger it manually
  run: (actorId: string | null) => Promise<unknown>;
}

export const JOB_DEFINITIONS: JobDefinition[] = [
  {
    name: "Generate recurring daily checks",
    cron: "5 0 * * *",
    description: "Materialises today's checklist instances from active recurring templates.",
    permission: "daily_checks.manage",
    run: (actorId) => generateDailyChecks(actorId),
  },
  {
    name: "Certificate & document expiry reminders",
    cron: "0 6 * * *",
    description: "Notifies owners of certificates/registrations approaching expiry at configured thresholds.",
    permission: "documents.manage",
    run: (actorId) => generateCertificateReminders(actorId),
  },
  {
    name: "Subscription renewal reminders",
    cron: "0 7 * * *",
    description: "Fires the most-urgent unsent renewal reminder per subscription at each threshold.",
    permission: "subscriptions.manage",
    run: (actorId) => generateSubscriptionReminders(actorId),
  },
  {
    name: "Publishing recurrence",
    cron: "10 0 * * *",
    description: "Generates upcoming publishing items from active recurrences.",
    permission: "social.manage",
    run: (actorId) => generateRecurringPublishing(actorId),
  },
  {
    name: "Workflow SLA escalations",
    cron: "0 * * * *",
    description: "Escalates active workflow instances whose stage SLA has been breached.",
    permission: "workflows.manage",
    run: (actorId) => escalateOverdueInstances(actorId ?? "system"),
  },
  {
    name: "Campaign spend backfill",
    cron: "30 1 * * *",
    description: "Recomputes derived campaign spend from metrics.",
    permission: "campaigns.manage",
    run: (actorId) => backfillCampaignSpend(actorId),
  },
  {
    name: "Session cleanup",
    cron: "40 2 * * *",
    description: "Purges sessions long past expiry or revocation (§28). Live sessions are untouched.",
    permission: "settings.manage",
    run: async () => ({ purged: await purgeStaleSessions() }),
  },
  {
    name: "Storage integrity scan",
    cron: "50 3 * * *",
    description: "Verifies recent file blobs still exist and match their stored checksum (§45-46); flags missing/corrupted objects.",
    permission: "settings.manage",
    run: async () => runStorageIntegrityScan({ limit: 1000 }),
  },
  {
    name: "Webhook delivery retries",
    cron: "* * * * *",
    description: "Drains due outbound webhook deliveries and retries failed ones with backoff (§36).",
    permission: "settings.manage",
    run: async () => deliverPendingWebhooks(200),
  },
];

export function jobByName(name: string): JobDefinition | undefined {
  return JOB_DEFINITIONS.find((j) => j.name === name);
}
