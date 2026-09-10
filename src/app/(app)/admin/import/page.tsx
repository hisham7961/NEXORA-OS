import type { Metadata } from "next";
import { pageGuard } from "@/lib/page-guard";
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
  // Resources the user may import (by the importer's permission).
  const resources = Object.entries(IMPORTERS)
    .filter(([, imp]) => canAnywhere(principal, imp.permission))
    .map(([key]) => ({ key, ...importerColumns(key) }));
  if (resources.length === 0) return <><PageHeader title="Import Data" /><Panel><EmptyState title="No import permissions" description="You need create permission on a module to import its data." /></Panel></>;

  const [companies, batches] = await Promise.all([accountingCompanies(principal), listImportBatches(principal)]);
  type Batch = (typeof batches)[number];
  const cols: Column<Batch>[] = [
    { key: "resource", header: "Resource", render: (b) => <span className="capitalize text-ink">{b.resource}</span> },
    { key: "when", header: "When", render: (b) => <span className="text-ink-3">{formatDateTime(b.createdAt, locale)}</span> },
    { key: "created", header: "Created", align: "end", render: (b) => <span className="tabular text-success">{b.created}</span> },
    { key: "skipped", header: "Skipped", align: "end", render: (b) => <span className="tabular text-ink-3">{b.skipped}</span> },
    { key: "errors", header: "Errors", align: "end", render: (b) => <span className={`tabular ${b.errorCount ? "text-critical" : "text-ink-3"}`}>{b.errorCount}</span> },
    { key: "status", header: "Status", align: "center", render: (b) => <Badge category={b.status === "completed" ? "success" : "critical"}>{b.status}</Badge> },
  ];

  return (
    <>
      <PageHeader title="Import Data" description="Upload a CSV, map its columns, preview and validate, then commit. Duplicates and invalid rows are detected before anything is written. Posted accounting data is never imported here." />
      <Panel className="mb-4">
        <PanelHeader title="New import" />
        <div className="px-4 py-3"><ImportWizard resources={resources} companies={companies.map((c) => ({ id: c.id, name: c.name }))} /></div>
      </Panel>
      <Panel>
        <PanelHeader title="Import history" />
        <DataTable columns={cols} rows={batches} getRowKey={(b) => b.id} empty={<EmptyState title="No imports yet" />} />
      </Panel>
    </>
  );
}
