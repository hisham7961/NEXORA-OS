import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { Download } from "lucide-react";
import { prisma } from "@/lib/db";
import { fileDownloadHref, formatBytes, isPreviewable } from "@/lib/files/display";
import { pageGuard } from "@/lib/page-guard";
import { AccessDenied } from "@/components/access-denied";
import { canAnywhere, can, ForbiddenError } from "@/lib/permissions/engine";
import { getDesign } from "@/domain/design";
import { getActivity } from "@/domain/mutation";
import { getScopedOptions } from "@/domain/options";
import { getLookups, refName } from "@/domain/lookups";
import { Panel, PanelHeader, PanelBody, StatusBadge, Badge } from "@/components/ui";
import { ActivityTimeline, type TimelineEntry } from "@/components/activity-timeline";
import { DesignForm } from "@/components/design/design-form";
import { DesignStatusBar, AddVersionButton, VersionDecision } from "@/components/design/design-actions";
import { BrandChip, UserChip } from "@/components/entity-chips";
import { formatDate, formatDateTime } from "@/lib/format";
import { getServerI18n } from "@/lib/server-i18n";

export const metadata: Metadata = { title: "Design Request" };

function isoDate(d: Date | null | undefined): string {
  return d ? new Date(d).toISOString().slice(0, 10) : "";
}

export default async function DesignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { principal, locale } = await pageGuard("design.view");
  const { t } = await getServerI18n();
  const { id } = await params;
  let req;
  try {
    req = await getDesign(principal, id);
  } catch (e) {
    if (e instanceof ForbiddenError) return <AccessDenied locale={locale} />;
    throw e;
  }
  if (!req) notFound();

  const canEdit = canAnywhere(principal, "design.edit");
  const canApprove = can(principal, "design.approve", { companyId: req.companyId, brandId: req.brandId, countryId: req.countryId });
  const [lookups, activity, options] = await Promise.all([
    getLookups(),
    getActivity("DesignRequest", id),
    canEdit ? getScopedOptions(principal, "design.edit") : Promise.resolve(null),
  ]);
  const timeline: TimelineEntry[] = activity.map((a) => ({
    id: a.id, at: a.at, actorName: a.actorId ? refName(lookups.users, a.actorId) : t("common.system"),
    actorColor: a.actorId ? lookups.users.get(a.actorId)?.meta : null, action: a.action, summary: a.summary,
  }));
  // Resolve the uploaded artwork file per version (for download/preview).
  const versionFileIds = req.versions.map((v) => v.fileId).filter((x): x is string => !!x);
  const versionFiles = versionFileIds.length
    ? new Map((await prisma.file.findMany({ where: { id: { in: versionFileIds } }, select: { id: true, name: true, mimeType: true, sizeBytes: true } })).map((f) => [f.id, f]))
    : new Map();

  return (
    <>
      <div className="mb-1 text-xs text-ink-3"><Link href="/design" className="hover:text-ink-2">{t("dp.designNav")}</Link> / {req.assetType}</div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold capitalize tracking-tight text-ink">{req.assetType}{req.dimensions ? ` · ${req.dimensions}` : ""}</h1>
          <div className="mt-0.5 flex items-center gap-2 text-xs text-ink-3">
            <StatusBadge module="design" status={req.status} />
            <Badge className="capitalize">{t(`priority.${req.priority}`)}</Badge>
          </div>
        </div>
        {canEdit && options && (
          <DesignForm
            mode="edit"
            options={{ brands: options.brands, countries: options.countries, companies: options.companies, users: options.users }}
            defaults={{
              id: req.id, assetType: req.assetType, dimensions: req.dimensions, platform: req.platform,
              copy: req.copy, priority: req.priority, deadline: isoDate(req.deadline),
              designerId: req.designerId, reviewerId: req.reviewerId,
            }}
          />
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Panel>
            <PanelHeader
              title={t("dp.versions")}
              description={t("dp.versionsSub")}
              action={canEdit ? <AddVersionButton requestId={req.id} /> : undefined}
            />
            <PanelBody>
              {req.versions.length === 0 ? <p className="text-[13px] text-ink-3">{t("dp.noVersions")}</p> : (
                <ul className="space-y-2">
                  {req.versions.map((v) => (
                    <li key={v.id} className="flex items-center justify-between gap-3 rounded-md border border-line bg-surface-2/40 px-3 py-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-ink-2">v{v.version}</span>
                          <span className="text-[13px] text-ink">{refName(lookups.users, v.uploadedById)}</span>
                          <span className="text-[11px] text-ink-3">{formatDateTime(v.createdAt, locale)}</span>
                          {v.isApproved ? <Badge category="success" dot>{t("dp.approved")}</Badge> : v.isRejected ? <Badge category="critical" dot>{t("dp.rejected")}</Badge> : <Badge category="neutral">{t("dp.inReview")}</Badge>}
                        </div>
                        {v.fileId && versionFiles.get(v.fileId) && (
                          <div className="mt-0.5 flex items-center gap-2 text-[11px] text-ink-3">
                            <span className="truncate">{versionFiles.get(v.fileId)!.name}</span>
                            <span>·</span>
                            <span>{formatBytes(versionFiles.get(v.fileId)!.sizeBytes)}</span>
                            {isPreviewable(versionFiles.get(v.fileId)!.mimeType) && (
                              <a href={fileDownloadHref(v.fileId, { inline: true })} target="_blank" rel="noreferrer" className="text-accent hover:underline">{t("dp.preview")}</a>
                            )}
                          </div>
                        )}
                        {v.note && <p className="mt-0.5 text-[12px] text-ink-3">{v.note}</p>}
                      </div>
                      <div className="flex items-center gap-2">
                        {v.fileId && <a href={fileDownloadHref(v.fileId)} className="text-ink-3 hover:text-accent" aria-label={t("dp.downloadV", { version: v.version })}><Download className="h-3.5 w-3.5" /></a>}
                        {!v.isApproved && <VersionDecision requestId={req.id} versionId={v.id} canApprove={canApprove} />}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </PanelBody>
          </Panel>
          <Panel>
            <PanelHeader title={t("dp.activity")} />
            <PanelBody><ActivityTimeline entries={timeline} locale={locale} empty={t("dp.noActivity")} /></PanelBody>
          </Panel>
        </div>

        <div className="space-y-4">
          {canEdit && (
            <Panel>
              <PanelHeader title={t("dp.lifecycle")} description={t("dp.designLifecycleSub")} />
              <PanelBody><DesignStatusBar requestId={req.id} status={req.status} /></PanelBody>
            </Panel>
          )}
          <Panel>
            <PanelHeader title={t("dp.brief")} />
            <PanelBody>
              <dl className="space-y-2.5 text-[13px]">
                <div className="flex justify-between"><dt className="text-ink-3">{t("common.brand")}</dt><dd><BrandChip name={refName(lookups.brands, req.brandId)} color={req.brandId ? lookups.brands.get(req.brandId)?.meta : null} /></dd></div>
                <div className="flex justify-between"><dt className="text-ink-3">{t("dp.requester")}</dt><dd><UserChip name={refName(lookups.users, req.requesterId)} color={req.requesterId ? lookups.users.get(req.requesterId)?.meta : null} /></dd></div>
                <div className="flex justify-between"><dt className="text-ink-3">{t("dp.designer")}</dt><dd><UserChip name={refName(lookups.users, req.designerId)} color={req.designerId ? lookups.users.get(req.designerId)?.meta : null} /></dd></div>
                <div className="flex justify-between"><dt className="text-ink-3">{t("dp.reviewer")}</dt><dd><UserChip name={refName(lookups.users, req.reviewerId)} color={req.reviewerId ? lookups.users.get(req.reviewerId)?.meta : null} /></dd></div>
                <div className="flex justify-between"><dt className="text-ink-3">{t("dp.deadline")}</dt><dd className="text-ink">{formatDate(req.deadline, locale)}</dd></div>
                <div className="flex justify-between"><dt className="text-ink-3">{t("dp.platform")}</dt><dd className="text-ink">{req.platform ?? "—"}</dd></div>
              </dl>
              {req.copy && <div className="mt-3 rounded-md bg-surface-2/50 p-2.5 text-[13px] text-ink-2 whitespace-pre-line">{req.copy}</div>}
            </PanelBody>
          </Panel>
        </div>
      </div>
    </>
  );
}
