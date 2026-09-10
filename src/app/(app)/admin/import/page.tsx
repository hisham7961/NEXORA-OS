import type { Metadata } from "next";
import { pageGuard } from "@/lib/page-guard";
import { getServerI18n } from "@/lib/server-i18n";
import { AccessDenied } from "@/components/access-denied";
import { canAnywhere } from "@/lib/permissions/engine";
import { IMPORTERS, importerColumns, listImportBatches } from "@/domain/importers";
import { accountingCompanies } from "@/domain/accounting/access";
import { PageHeader, Panel, PanelHeader, DataTable, EmptyState, Badge, type Column } from "@/components/ui";
import { ImportWizard } from "@/components/admin/import-wizard";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Import Data" };

export default async function ImportPage() {
  const { principal, locale, denied } = await pageGuard("settings.view");
  if (denied) return <AccessDenied locale={locale} />;
  const { t } = await getServerI18n();
  // Resources the user may import (by the importer's permission).
  const resources = Object.entries(IMPORTERS)
    .filter(([, imp]) => canAnywhere(principal, imp.permission))
    .map(([key]) => ({ key, ...importerColumns(key) }));
  if (resources.length === 0) return <><PageHeader title={t("admin.importData")} /><Panel><EmptyState title={t("admin.noImportPerms")} description={t("admin.noImportPermsSub")} /></Panel></>;

  const [companies, batches] = await Promise.all([accountingCompanies(principal), listImportBatches(principal)]);
  type Batch = (typeof batches)[number];
  const cols: Column<Batch>[] = [
    { key: "resource", header: t("admin.col.resource"), render: (b) => <span className="capitalize text-ink">{b.resource}</span> },
    { key: "when", header: t("admin.col.when"), render: (b) => <span className="text-ink-3">{formatDateTime(b.createdAt, locale)}</span> },
    { key: "created", header: t("admin.col.created"), align: "end", render: (b) => <span className="tabular text-success">{b.created}</span> },
    { key: "skipped", header: t("admin.col.skipped"), align: "end", render: (b) => <span className="tabular text-ink-3">{b.skipped}</span> },
    { key: "errors", header: t("admin.col.errors"), align: "end", render: (b) => <span className={`tabular ${b.errorCount ? "text-critical" : "text-ink-3"}`}>{b.errorCount}</span> },
    { key: "status", header: t("common.status"), align: "center", render: (b) => <Badge category={b.status === "completed" ? "success" : "critical"}>{t(`status.${b.status}`)}</Badge> },
  ];

  return (
    <>
      <PageHeader title={t("admin.importData")} description={t("admin.importDataSub")} />
      <Panel className="mb-4">
        <PanelHeader title={t("admin.newImport")} />
        <div className="px-4 py-3"><ImportWizard resources={resources} companies={companies.map((c) => ({ id: c.id, name: c.name }))} /></div>
      </Panel>
      <Panel>
        <PanelHeader title={t("admin.importHistory")} />
        <DataTable columns={cols} rows={batches} getRowKey={(b) => b.id} empty={<EmptyState title={t("admin.noImports")} />} />
      </Panel>
    </>
  );
}
