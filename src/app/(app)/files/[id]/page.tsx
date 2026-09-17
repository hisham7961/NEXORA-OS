import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { FileText, Lock, Download, Eye } from "lucide-react";
import { pageGuard } from "@/lib/page-guard";
import { AccessDenied } from "@/components/access-denied";
import { canAnywhere, ForbiddenError } from "@/lib/permissions/engine";
import { getFile, getFileVersions } from "@/domain/files";
import { getActivity } from "@/domain/mutation";
import { getLookups, refName } from "@/domain/lookups";
import { Panel, PanelHeader, PanelBody, Badge } from "@/components/ui";
import { ActivityTimeline, type TimelineEntry } from "@/components/activity-timeline";
import { AddVersionButton, EditFileButton, ArchiveFileButton } from "@/components/files/file-controls";
import { BrandChip, CountryChip, UserChip } from "@/components/entity-chips";
import { formatDateTime } from "@/lib/format";
import { getServerI18n } from "@/lib/server-i18n";
import { formatBytes, fileDownloadHref, isPreviewable, FILE_CATEGORY_LABELS } from "@/lib/files/display";

export const metadata: Metadata = { title: "File" };

export default async function FileDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { principal, locale } = await pageGuard("files.view");
  const { t } = await getServerI18n();
  const { id } = await params;

  let file;
  try {
    file = await getFile(principal, id);
  } catch (e) {
    if (e instanceof ForbiddenError) return <AccessDenied locale={locale} />;
    throw e;
  }
  if (!file) notFound();

  const canEdit = canAnywhere(principal, "files.edit");
  const [versions, activity, lookups] = await Promise.all([
    getFileVersions(principal, id),
    getActivity("File", id),
    getLookups(),
  ]);
  const timeline: TimelineEntry[] = activity.map((a) => ({
    id: a.id, at: a.at, actorName: a.actorId ? refName(lookups.users, a.actorId) : t("common.system"),
    actorColor: a.actorId ? lookups.users.get(a.actorId)?.meta : null, action: a.action, summary: a.summary,
  }));

  return (
    <>
      <div className="mb-1 text-xs text-ink-3"><Link href="/files" className="hover:text-ink-2">{t("dp.filesNav")}</Link> / {file.name}</div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-accent"><FileText className="h-5 w-5" /></div>
          <div>
            <h1 className="flex items-center gap-2 text-lg font-semibold tracking-tight text-ink">
              {file.name}
              {file.visibility === "restricted" && <Lock className="h-4 w-4 text-warning" />}
            </h1>
            <div className="mt-0.5 flex items-center gap-2 text-xs text-ink-3">
              <Badge category="neutral">{FILE_CATEGORY_LABELS[file.category] ?? file.category}</Badge>
              <span>{formatBytes(file.sizeBytes)}</span>
              {file.tags.map((tg) => <Badge key={tg} category="info">{tg}</Badge>)}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <a href={fileDownloadHref(file.id)} className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-[13px] font-medium text-white hover:bg-accent/90"><Download className="h-4 w-4" /> {t("fil.download")}</a>
          {isPreviewable(file.mimeType) && <a href={fileDownloadHref(file.id, { inline: true })} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-md border border-line px-3 py-1.5 text-[13px] text-ink-2 hover:bg-surface-2"><Eye className="h-4 w-4" /> {t("dp.preview")}</a>}
          {canEdit && <AddVersionButton fileId={file.id} />}
          {canEdit && <EditFileButton file={{ id: file.id, name: file.name, description: file.description, category: file.category, tags: file.tags, visibility: file.visibility }} />}
          {canEdit && <ArchiveFileButton fileId={file.id} redirectTo="/files" />}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Panel>
            <PanelHeader title={t("dp.versions")} description={t("fil.versionsSub")} />
            <ul className="divide-y divide-line">
              {versions.map((v) => (
                <li key={v.id} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="font-mono text-xs text-ink-2">v{v.version}</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] text-ink">{refName(lookups.users, v.uploadedById)}</div>
                    <div className="text-[11px] text-ink-3">{formatDateTime(v.createdAt, locale)} · {formatBytes(v.sizeBytes)}{v.note ? ` · ${v.note}` : ""}</div>
                  </div>
                  {v.checksum && <span className="hidden font-mono text-[10px] text-ink-3 sm:inline" title="sha256">{v.checksum.slice(0, 10)}…</span>}
                  <a href={fileDownloadHref(file.id, { versionId: v.id })} className="text-ink-3 hover:text-accent" aria-label={t("dp.downloadV", { version: v.version })}><Download className="h-3.5 w-3.5" /></a>
                </li>
              ))}
            </ul>
          </Panel>
          <Panel>
            <PanelHeader title={t("dp.activity")} />
            <PanelBody><ActivityTimeline entries={timeline} locale={locale} empty={t("dp.noActivity")} /></PanelBody>
          </Panel>
        </div>

        <Panel>
          <PanelHeader title={t("dp.details")} />
          <PanelBody>
            <dl className="space-y-2.5 text-[13px]">
              <Row label={t("camp.owner")}>{file.ownerId ? <UserChip name={refName(lookups.users, file.ownerId)} color={lookups.users.get(file.ownerId)?.meta} /> : "—"}</Row>
              <Row label={t("common.brand")}><BrandChip name={refName(lookups.brands, file.brandId)} color={file.brandId ? lookups.brands.get(file.brandId)?.meta : null} /></Row>
              <Row label={t("common.market")}><CountryChip name={refName(lookups.countries, file.countryId)} iso2={file.countryId ? lookups.countries.get(file.countryId)?.meta : null} /></Row>
              <Row label={t("filef.visibility")}><span className="text-ink">{file.visibility === "restricted" ? t("filef.restricted") : t("filef.internal")}</span></Row>
              <Row label={t("common.type")}><span className="text-ink-2">{file.mimeType ?? "—"}</span></Row>
              <Row label={t("fil.uploaded")}><span className="text-ink-2">{formatDateTime(file.createdAt, locale)}</span></Row>
            </dl>
            {file.description && <p className="mt-3 rounded-md bg-surface-2/50 p-2.5 text-[13px] text-ink-2 whitespace-pre-line">{file.description}</p>}
          </PanelBody>
        </Panel>
      </div>
    </>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-ink-3">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
