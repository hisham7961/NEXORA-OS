import { FileText, Lock, Download } from "lucide-react";
import { canAnywhere, type Principal } from "@/lib/permissions/engine";
import { listFilesForEntity } from "@/domain/files";
import { getScopedOptions } from "@/domain/options";
import { Panel, PanelHeader, PanelBody, Badge } from "@/components/ui";
import { UploadFileButton } from "@/components/files/file-controls";
import { DetachFileButton } from "@/components/files/detach-button";
import { formatBytes, fileDownloadHref, FILE_CATEGORY_LABELS } from "@/lib/files/display";
import Link from "next/link";
import { getServerI18n } from "@/lib/server-i18n";

/**
 * Reusable "Files" panel for any entity detail page (§5). One file platform,
 * many attachment points — never a per-module file store. Renders the entity's
 * attached files with authorized download links, and (for editors) an
 * upload-and-attach button that inherits the entity's scope.
 */
export async function EntityFiles({
  principal,
  entityType,
  entityId,
  scope,
  title,
}: {
  principal: Principal;
  entityType: string;
  entityId: string;
  scope?: { companyId?: string | null; brandId?: string | null; countryId?: string | null };
  title?: string;
}) {
  const { t } = await getServerI18n();
  const canUpload = canAnywhere(principal, "files.create");
  const canEdit = canAnywhere(principal, "files.edit");
  const [files, options] = await Promise.all([
    listFilesForEntity(principal, entityType, entityId),
    canUpload ? getScopedOptions(principal, "files.create") : Promise.resolve(null),
  ]);

  return (
    <Panel>
      <PanelHeader
        title={title ?? t("ef.filesTitle")}
        description={t("ef.subtitle")}
        action={canUpload && options ? (
          <UploadFileButton
            variant="secondary"
            label={t("ef.attach")}
            options={{ brands: options.brands, countries: options.countries, companies: options.companies }}
            related={{ type: entityType, id: entityId }}
            scope={scope}
          />
        ) : undefined}
      />
      {files.length === 0 ? (
        <PanelBody className="text-[13px] text-ink-3">{t("ef.noFiles")}</PanelBody>
      ) : (
        <ul className="divide-y divide-line">
          {files.map((f) => (
            <li key={f.id} className="flex items-center gap-3 px-4 py-2.5">
              <FileText className="h-4 w-4 shrink-0 text-ink-3" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Link href={`/files/${f.id}`} className="truncate text-[13px] font-medium text-ink hover:text-accent">{f.name}</Link>
                  {f.visibility === "restricted" && <Lock className="h-3 w-3 text-warning" />}
                  <Badge category="neutral">{FILE_CATEGORY_LABELS[f.category] ?? f.category}</Badge>
                </div>
                <div className="text-[11px] text-ink-3">{formatBytes(f.sizeBytes)}</div>
              </div>
              <a href={fileDownloadHref(f.id)} className="text-ink-3 hover:text-accent" aria-label={t("common.download")}><Download className="h-4 w-4" /></a>
              {canEdit && <DetachFileButton fileId={f.id} entityType={entityType} entityId={entityId} />}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
