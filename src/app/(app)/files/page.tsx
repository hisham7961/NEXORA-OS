import type { Metadata } from "next";
import { Folder, FileText, Lock } from "lucide-react";
import { pageGuard } from "@/lib/page-guard";
import { AccessDenied } from "@/components/access-denied";
import { canAnywhere } from "@/lib/permissions/engine";
import { prisma } from "@/lib/db";
import { PageHeader, Panel, PanelHeader, EmptyState, Badge } from "@/components/ui";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Files" };

export default async function FilesPage() {
  const { principal, locale, denied } = await pageGuard("files.view");
  if (denied) return <AccessDenied locale={locale} />;
  const canRestricted = canAnywhere(principal, "files.view_restricted");

  const [folders, files] = await Promise.all([
    prisma.folder.findMany({ orderBy: { name: "asc" }, take: 100 }),
    prisma.file.findMany({
      where: { archivedAt: null, ...(canRestricted ? {} : { visibility: { not: "restricted" } }) },
      orderBy: { updatedAt: "desc" },
      take: 100,
    }),
  ]);

  return (
    <>
      <PageHeader title="Files" description="Shared, department, brand, regulatory and restricted files — versioned and permission-protected (§21)." />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel>
          <PanelHeader title="Folders" />
          {folders.length === 0 ? (
            <EmptyState icon={<Folder className="h-5 w-5" />} title="No folders" description="Organize files by scope: shared, department, brand, regulatory, creative, restricted, vault." />
          ) : (
            <ul className="divide-y divide-line">
              {folders.map((f) => (
                <li key={f.id} className="flex items-center gap-2.5 px-4 py-2.5">
                  <Folder className="h-4 w-4 text-ink-3" />
                  <span className="flex-1 text-[13px] text-ink">{f.name}</span>
                  <Badge category="neutral">{f.scopeType}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel className="lg:col-span-2">
          <PanelHeader title="Recent files" description={canRestricted ? "Including restricted files (you have access)." : "Restricted files are hidden from your scope."} />
          {files.length === 0 ? (
            <EmptyState icon={<FileText className="h-5 w-5" />} title="No files" description="Uploads appear here with versions and access history. Important files are never overwritten." />
          ) : (
            <ul className="divide-y divide-line">
              {files.map((f) => (
                <li key={f.id} className="flex items-center gap-2.5 px-4 py-2.5">
                  <FileText className="h-4 w-4 text-ink-3" />
                  <span className="flex-1 text-[13px] text-ink">{f.name}</span>
                  {f.visibility === "restricted" && <Lock className="h-3.5 w-3.5 text-warning" />}
                  <span className="text-[11px] text-ink-3 tabular">{formatDate(f.updatedAt, locale)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
