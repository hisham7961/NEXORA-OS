import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { Share2, ExternalLink } from "lucide-react";
import { pageGuard } from "@/lib/page-guard";
import { AccessDenied } from "@/components/access-denied";
import { canAnywhere, ForbiddenError } from "@/lib/permissions/engine";
import { getPublishingItem } from "@/domain/social";
import { getActivity } from "@/domain/mutation";
import { getScopedOptions } from "@/domain/options";
import { getLookups, refName } from "@/domain/lookups";
import { Panel, PanelHeader, PanelBody, StatusBadge, Badge } from "@/components/ui";
import { ActivityTimeline, type TimelineEntry } from "@/components/activity-timeline";
import { EntityFiles } from "@/components/files/entity-files";
import { PublishingForm } from "@/components/social/publishing-form";
import { PublishingActionBar } from "@/components/social/publishing-actions";
import { BrandChip, CountryChip, UserChip } from "@/components/entity-chips";
import { formatDate, formatDateTime } from "@/lib/format";
import { humanize } from "@/lib/status";
import { getServerI18n } from "@/lib/server-i18n";

export const metadata: Metadata = { title: "Publishing item" };

function isoDate(d: Date | null | undefined): string {
  return d ? new Date(d).toISOString().slice(0, 10) : "";
}

export default async function PublishingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { principal, locale } = await pageGuard("social.view");
  const { t } = await getServerI18n();
  const { id } = await params;

  let data;
  try {
    data = await getPublishingItem(principal, id);
  } catch (e) {
    if (e instanceof ForbiddenError) return <AccessDenied locale={locale} />;
    throw e;
  }
  if (!data) notFound();
  const { item, recurrence } = data;

  const canEdit = canAnywhere(principal, "social.edit");
  const [lookups, activity, options] = await Promise.all([
    getLookups(),
    getActivity("PublishingItem", id),
    canEdit ? getScopedOptions(principal, "social.edit") : Promise.resolve(null),
  ]);
  const timeline: TimelineEntry[] = activity.map((a) => ({
    id: a.id, at: a.at, actorName: a.actorId ? refName(lookups.users, a.actorId) : t("common.system"),
    actorColor: a.actorId ? lookups.users.get(a.actorId)?.meta : null, action: a.action, summary: a.summary,
  }));

  return (
    <>
      <div className="mb-1 text-xs text-ink-3"><Link href="/social" className="hover:text-ink-2">{t("dp.socialNav")}</Link> / {humanize(item.contentType)}</div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-accent"><Share2 className="h-5 w-5" /></div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-ink">{humanize(item.contentType)}{item.platform ? ` · ${humanize(item.platform)}` : ""}</h1>
            <div className="mt-0.5 flex items-center gap-2 text-xs text-ink-3">
              <BrandChip name={refName(lookups.brands, item.brandId)} color={item.brandId ? lookups.brands.get(item.brandId)?.meta : null} />
              <CountryChip name={refName(lookups.countries, item.countryId)} iso2={item.countryId ? lookups.countries.get(item.countryId)?.meta : null} />
              <StatusBadge module="publishing" status={item.status} />
              {recurrence && <Badge category="info">{t("soc.recurring")}</Badge>}
            </div>
          </div>
        </div>
        {canEdit && options && (
          <PublishingForm
            mode="edit"
            options={{ brands: options.brands, countries: options.countries, users: options.users }}
            defaults={{
              id: item.id, contentType: item.contentType, platform: item.platform,
              ownerId: item.ownerId, designerId: item.designerId,
              publishDate: isoDate(item.publishDate), publishTime: item.publishTime,
              caption: item.caption, notes: item.notes,
            }}
          />
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Panel>
            <PanelHeader title={t("soc.content")} />
            <PanelBody className="space-y-3">
              {item.caption ? <p className="text-[13px] text-ink whitespace-pre-line">{item.caption}</p> : <p className="text-[13px] text-ink-3">{t("soc.noCaption")}</p>}
              {item.notes && <div><div className="text-[11px] font-semibold uppercase tracking-wide text-ink-3">{t("camp.notes")}</div><p className="mt-1 text-[13px] text-ink-2 whitespace-pre-line">{item.notes}</p></div>}
              {item.publishedUrl && (
                <a href={item.publishedUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-[13px] text-accent hover:underline">
                  <ExternalLink className="h-3.5 w-3.5" /> {t("soc.viewPublished")}
                </a>
              )}
            </PanelBody>
          </Panel>
          <Panel>
            <PanelHeader title={t("dp.activity")} />
            <PanelBody><ActivityTimeline entries={timeline} locale={locale} empty={t("dp.noActivity")} /></PanelBody>
          </Panel>
          <EntityFiles principal={principal} entityType="PublishingItem" entityId={item.id} scope={{ brandId: item.brandId, countryId: item.countryId }} />
        </div>

        <div className="space-y-4">
          {canEdit && (
            <Panel>
              <PanelHeader title={t("dp.actions")} />
              <PanelBody>
                <PublishingActionBar
                  itemId={item.id}
                  status={item.status}
                  scheduledConfirmedAt={item.scheduledConfirmedAt ? item.scheduledConfirmedAt.toISOString() : null}
                  publishedConfirmedAt={item.publishedConfirmedAt ? item.publishedConfirmedAt.toISOString() : null}
                />
              </PanelBody>
            </Panel>
          )}
          <Panel>
            <PanelHeader title={t("dp.details")} />
            <PanelBody>
              <dl className="space-y-2.5 text-[13px]">
                <Row label={t("pub.publishDate")}><span className="text-ink">{formatDate(item.publishDate, locale)}{item.publishTime ? ` · ${item.publishTime}` : ""}</span></Row>
                <Row label={t("camp.owner")}>{item.ownerId ? <UserChip name={refName(lookups.users, item.ownerId)} color={lookups.users.get(item.ownerId)?.meta} /> : <span className="text-ink-3">—</span>}</Row>
                <Row label={t("dp.designer")}>{item.designerId ? <UserChip name={refName(lookups.users, item.designerId)} color={lookups.users.get(item.designerId)?.meta} /> : <span className="text-ink-3">—</span>}</Row>
                <Row label={t("soc.scheduledAt")}><span className="text-ink-2">{item.scheduledConfirmedAt ? formatDateTime(item.scheduledConfirmedAt, locale) : "—"}</span></Row>
                <Row label={t("soc.publishedAt")}><span className="text-ink-2">{item.publishedConfirmedAt ? formatDateTime(item.publishedConfirmedAt, locale) : "—"}</span></Row>
              </dl>
            </PanelBody>
          </Panel>
        </div>
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
