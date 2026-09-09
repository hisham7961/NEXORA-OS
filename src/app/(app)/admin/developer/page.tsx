import type { Metadata } from "next";
import { Terminal, Check, X } from "lucide-react";
import { pageGuard } from "@/lib/page-guard";
import { AccessDenied } from "@/components/access-denied";
import { getDeveloperPortal } from "@/domain/platform";
import { PageHeader, Panel, PanelHeader, DataTable, StatusBadge, Badge, EmptyState } from "@/components/ui";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Developer Portal" };

function Bool({ ok }: { ok: boolean }) {
  return ok ? <Check className="h-3.5 w-3.5 text-success" /> : <X className="h-3.5 w-3.5 text-ink-3" />;
}

export default async function DeveloperPortalPage() {
  const { locale, denied } = await pageGuard("developer.view");
  if (denied) return <AccessDenied locale={locale} />;
  const { features, tokens, endpoints } = await getDeveloperPortal();

  return (
    <>
      <PageHeader title="Developer Portal" description="API, feature registry and tokens — the same backend the mobile app will use (§33, §35)." />

      <Panel className="mb-4">
        <PanelHeader title="Feature Registry" description="Web + mobile-API availability per feature (§34) — no hidden systems." icon={<Terminal className="h-4 w-4" />} />
        <DataTable
          columns={[
            { key: "name", header: "Feature", render: (f) => f.name },
            { key: "module", header: "Module", render: (f) => <span className="text-ink-3">{f.module}</span> },
            { key: "web", header: "Web", align: "center", render: (f) => <Bool ok={f.webAvailable} /> },
            { key: "mobile", header: "Mobile API", align: "center", render: (f) => <Bool ok={f.mobileApiAvailable} /> },
            { key: "perm", header: "Permission", render: (f) => <span className="font-mono text-[11px] text-ink-3">{f.permissionKey ?? "—"}</span> },
            { key: "endpoint", header: "Endpoint", render: (f) => <span className="font-mono text-[11px] text-ink-2">{f.endpoint ?? "—"}</span> },
            { key: "status", header: "Status", align: "end", render: (f) => <StatusBadge module="generic" status={f.status} /> },
          ]}
          rows={features}
          getRowKey={(f) => f.id}
          empty={<EmptyState title="No features registered" description="Register features to declare web/mobile parity and endpoints." />}
        />
      </Panel>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel>
          <PanelHeader title="API endpoints" description="Versioned REST — GET /api/v1/health is public." />
          <ul className="divide-y divide-line">
            {endpoints.map((e) => (
              <li key={e.endpoint} className="flex items-center justify-between px-4 py-2.5">
                <span className="font-mono text-[12px] text-ink">{e.endpoint}</span>
                <span className="flex items-center gap-2">{e.mobile && <Badge category="info">mobile</Badge>}<span className="font-mono text-[10.5px] text-ink-3">{e.permission ?? ""}</span></span>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel>
          <PanelHeader title="API tokens" description="Secrets are never displayed (§35)." />
          <DataTable
            columns={[
              { key: "name", header: "Name", render: (t) => t.name },
              { key: "prefix", header: "Prefix", render: (t) => <span className="font-mono text-xs text-ink-3">{t.prefix}…</span> },
              { key: "used", header: "Last used", align: "end", render: (t) => formatDate(t.lastUsedAt, locale) },
            ]}
            rows={tokens}
            getRowKey={(t) => t.id}
            empty={<EmptyState title="No API tokens" description="Issue tokens for integrations; only the prefix is ever shown." />}
          />
        </Panel>
      </div>
    </>
  );
}
