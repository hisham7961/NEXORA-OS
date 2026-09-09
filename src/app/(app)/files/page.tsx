import type { Metadata } from "next";
import Link from "next/link";
import { Folder, FileText, Lock, Download } from "lucide-react";
import { pageGuard } from "@/lib/page-guard";
import { AccessDenied } from "@/components/access-denied";
import { canAnywhere } from "@/lib/permissions/engine";
import { listFiles, listFolders, fileQuerySchema } from "@/domain/files";
import { getScopedOptions } from "@/domain/options";
import { PageHeader, Panel, PanelHeader, DataTable, EmptyState, Badge, type Column } from "@/components/ui";
import { ListToolbar } from "@/components/list/toolbar";
import { Pagination } from "@/components/list/pagination";
import { UploadFileButton, NewFolderButton } from "@/components/files/file-controls";
import { formatBytes, fileDownloadHref, FILE_CATEGORY_LABELS } from "@/lib/files/display";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Files" };

const CATEGORIES = ["document", "image", "video", "creative", "regulatory", "contract", "spreadsheet", "other"];

type Row = Awaited<ReturnType<typeof listFiles>>["rows"][number];

export default async function FilesPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const { principal, locale, denied } = await pageGuard("files.view");
  if (denied) return <AccessDenied locale={locale} />;
  const sp = await searchParams;
  const query = fileQuerySchema.parse(sp);
  const canCreate = canAnywhere(principal, "files.create");
  const [{ rows, total }, folders, options] = await Promise.all([
    listFiles(principal, query),
    listFolders(principal),
    canCreate ? getScopedOptions(principal, "files.create") : Promise.resolve(null),
  ]);

  const columns: Column<Row>[] = [
    { key: "name", header: "File", render: (f) => (
      <div className="flex items-center gap-2">
        <FileText className="h-4 w-4 text-ink-3" />
        <Link href={`/files/${f.id}`} className="font-medium text-ink hover:text-accent">{f.name}</Link>
        {f.visibility === "restricted" && <Lock className="h-3 w-3 text-warning" />}
      </div>
    ) },
    { key: "category", header: "Category", render: (f) => <Badge category="neutral">{FILE_CATEGORY_LABELS[f.category] ?? f.category}</Badge> },
    { key: "size", header: "Size", align: "end", render: (f) => <span className="tabular text-ink-3">{formatBytes(f.sizeBytes)}</span> },
    { key: "updated", header: "Updated", align: "end", render: (f) => <span className="tabular text-ink-3">{formatDate(f.updatedAt, locale)}</span> },
    { key: "dl", header: "", align: "end", render: (f) => <a href={fileDownloadHref(f.id)} className="text-ink-3 hover:text-accent" aria-label="Download"><Download className="h-4 w-4" /></a> },
  ];

  return (
    <>
      <PageHeader
        title="Files"
        description="Shared, brand, regulatory and restricted files — real storage, versioned and permission-protected (§21)."
        meta={<Badge>{total} files</Badge>}
        actions={canCreate && options ? (
          <div className="flex items-center gap-2">
            <NewFolderButton options={{ brands: options.brands, companies: options.companies }} />
            <UploadFileButton options={{ brands: options.brands, countries: options.countries, companies: options.companies }} folders={folders.map((f) => ({ id: f.id, label: f.name }))} />
          </div>
        ) : undefined}
      />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        <Panel className="lg:col-span-1">
          <PanelHeader title="Folders" />
          {folders.length === 0 ? (
            <EmptyState icon={<Folder className="h-5 w-5" />} title="No folders" description="Organize files by scope." />
          ) : (
            <ul className="divide-y divide-line">
              <li>
                <Link href="/files" className={`flex items-center gap-2.5 px-4 py-2 text-[13px] ${!query.folderId ? "text-accent" : "text-ink hover:bg-surface-2/50"}`}>
                  <Folder className="h-4 w-4" /> All files
                </Link>
              </li>
              {folders.map((f) => (
                <li key={f.id}>
                  <Link href={`/files?folderId=${f.id}`} className={`flex items-center gap-2.5 px-4 py-2 text-[13px] ${query.folderId === f.id ? "text-accent" : "text-ink hover:bg-surface-2/50"}`}>
                    <Folder className="h-4 w-4 text-ink-3" />
                    <span className="flex-1 truncate">{f.name}</span>
                    <Badge category="neutral">{f.scopeType}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <div className="lg:col-span-3">
          <ListToolbar
            placeholder="Search files…"
            filters={[{ name: "category", label: "Category", options: CATEGORIES.map((c) => ({ value: c, label: FILE_CATEGORY_LABELS[c] })) }]}
          />
          <Panel>
            <DataTable
              columns={columns}
              rows={rows}
              getRowKey={(f) => f.id}
              empty={<EmptyState icon={<FileText className="h-5 w-5" />} title="No files" description="Uploads appear here with versions and access history. Important files are never overwritten." />}
            />
            {total > query.pageSize && <Pagination page={query.page} pageSize={query.pageSize} total={total} params={sp} />}
          </Panel>
        </div>
      </div>
    </>
  );
}
