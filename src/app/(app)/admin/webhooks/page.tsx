import type { Metadata } from "next";
import { Webhook } from "lucide-react";
import { pageGuard } from "@/lib/page-guard";
import { AccessDenied } from "@/components/access-denied";
import { listWebhooks } from "@/domain/webhooks";
import { PageHeader, Panel, PanelHeader, PanelBody } from "@/components/ui";
import { WebhookManager, type WebhookRow } from "@/components/admin/webhook-manager";

export const metadata: Metadata = { title: "Webhooks" };

// A representative set of subscribable events (audit action names). "*" subscribes
// to everything; these just seed the input's autocomplete.
const KNOWN_EVENTS = [
  "*", "invoice.posted", "invoice.created", "bill.posted", "payment.recorded",
  "campaign.updated", "task.assigned", "case.updated", "registration.updated",
  "document.uploaded", "user.created", "webhook.created", "data.exported", "data.imported",
];

export default async function WebhooksPage() {
  const { principal, locale, denied } = await pageGuard("settings.view");
  if (denied) return <AccessDenied locale={locale} />;
  const hooks = await listWebhooks(principal);
  const rows: WebhookRow[] = hooks.map((w) => ({ id: w.id, name: w.name, url: w.url, events: w.events, active: w.active, createdAt: w.createdAt.toISOString() }));

  return (
    <>
      <PageHeader title="Webhooks" description="Send signed event deliveries to external systems. Each request carries an HMAC signature (X-Nexora-Signature) so the receiver can verify it; failed deliveries retry with backoff." />
      <Panel>
        <PanelHeader title="Endpoints" description="Subscribe a URL to events. The signing secret is shown once at creation." icon={<Webhook className="h-4 w-4" />} />
        <PanelBody>
          <WebhookManager webhooks={rows} knownEvents={KNOWN_EVENTS} />
        </PanelBody>
      </Panel>
    </>
  );
}
