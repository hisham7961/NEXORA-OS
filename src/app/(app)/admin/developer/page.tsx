import type { Metadata } from "next";
import { Terminal, Check, X } from "lucide-react";
import { pageGuard } from "@/lib/page-guard";
import { getServerI18n } from "@/lib/server-i18n";
import { AccessDenied } from "@/components/access-denied";
import { getDeveloperPortal } from "@/domain/platform";
import { reconcileFeatures } from "@/domain/api-docs";
import { listApiTokens } from "@/domain/api-tokens";
import { ApiTokenManager, type TokenRow } from "@/components/admin/api-token-manager";
import { PageHeader, Panel, PanelHeader, PanelBody, DataTable, StatusBadge, Badge, EmptyState } from "@/components/ui";

export const metadata: Metadata = { title: "Developer Portal" };

function Bool({ ok }: { ok: boolean }) {
  return ok ? <Check className="h-3.5 w-3.5 text-success" /> : <X className="h-3.5 w-3.5 text-ink-3" />;
}

export default async function DeveloperPortalPage() {
  const { principal, locale, denied } = await pageGuard("developer.view");
  if (denied) return <AccessDenied locale={locale} />;
  const { t } = await getServerI18n();
  const { features, endpoints } = await getDeveloperPortal();
  const reconcile = await reconcileFeatures();
  const myTokens = await listApiTokens(principal);
  const tokenRows: TokenRow[] = myTokens.map((t) => ({
    id: t.id, name: t.name, prefix: t.prefix, readOnly: t.readOnly, status: t.status,
    lastUsedAt: t.lastUsedAt ? t.lastUsedAt.toISOString() : null,
    expiresAt: t.expiresAt ? t.expiresAt.toISOString() : null,
    createdAt: t.createdAt.toISOString(),
  }));

  return (
    <>
      <PageHeader title={t("admin.developerPortal")} description={t("admin.developerPortalSub")} />

      <Panel className="mb-4">
        <PanelHeader
          title={t("admin.featureRegistry")}
          description={t("admin.featureRegistrySub")}
          icon={<Terminal className="h-4 w-4" />}
          action={reconcile.issues.length === 0
            ? <Badge category="success">{t("admin.registryReconciled", { ok: reconcile.ok })}</Badge>
            : <Badge category="warning">{reconcile.issues.length === 1 ? t("admin.driftIssue", { count: reconcile.issues.length }) : t("admin.driftIssues", { count: reconcile.issues.length })}</Badge>}
        />
        {reconcile.issues.length > 0 && (
          <ul className="border-b border-line bg-warning/5 px-4 py-2 text-[12px] text-warning">
            {reconcile.issues.slice(0, 8).map((i) => <li key={i.key}>· <span className="font-medium">{i.name}</span> {i.problem}</li>)}
          </ul>
        )}
        <DataTable
          columns={[
            { key: "name", header: t("admin.col.feature"), render: (f) => f.name },
            { key: "module", header: t("admin.col.module"), render: (f) => <span className="text-ink-3">{f.module}</span> },
            { key: "web", header: t("admin.col.web"), align: "center", render: (f) => <Bool ok={f.webAvailable} /> },
            { key: "mobile", header: t("admin.col.mobileApi"), align: "center", render: (f) => <Bool ok={f.mobileApiAvailable} /> },
            { key: "perm", header: t("admin.col.permission"), render: (f) => <span className="font-mono text-[11px] text-ink-3">{f.permissionKey ?? "—"}</span> },
            { key: "endpoint", header: t("admin.col.endpoint"), render: (f) => <span className="font-mono text-[11px] text-ink-2">{f.endpoint ?? "—"}</span> },
            { key: "status", header: t("common.status"), align: "end", render: (f) => <StatusBadge module="generic" status={f.status} /> },
          ]}
          rows={features}
          getRowKey={(f) => f.id}
          empty={<EmptyState title={t("admin.noFeatures")} description={t("admin.noFeaturesSub")} />}
        />
      </Panel>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel>
          <PanelHeader title={t("admin.apiEndpoints")} description={t("admin.apiEndpointsSub")} action={<a href="/api/v1/openapi.json" target="_blank" rel="noreferrer" className="text-[11px] text-accent hover:underline">OpenAPI ↗</a>} />
          <ul className="divide-y divide-line">
            {endpoints.map((e) => (
              <li key={e.endpoint} className="flex items-center justify-between px-4 py-2.5">
                <span className="font-mono text-[12px] text-ink">{e.endpoint}</span>
                <span className="flex items-center gap-2">{e.mobile && <Badge category="info">{t("admin.mobile")}</Badge>}<span className="font-mono text-[10.5px] text-ink-3">{e.permission ?? ""}</span></span>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel>
          <PanelHeader title={t("admin.apiTokens")} description={t("admin.apiTokensSub")} />
          <PanelBody>
            <ApiTokenManager tokens={tokenRows} />
          </PanelBody>
        </Panel>
      </div>
    </>
  );
}
