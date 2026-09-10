import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { MessageCircle } from "lucide-react";
import { pageGuard } from "@/lib/page-guard";
import { AccessDenied } from "@/components/access-denied";
import { canAnywhere, can, ForbiddenError } from "@/lib/permissions/engine";
import { getWhatsappCampaign } from "@/domain/whatsapp";
import { getActivity } from "@/domain/mutation";
import { getScopedOptions } from "@/domain/options";
import { getLookups, refName } from "@/domain/lookups";
import { Panel, PanelHeader, PanelBody, StatusBadge, Metric, EmptyState } from "@/components/ui";
import { ActivityTimeline, type TimelineEntry } from "@/components/activity-timeline";
import { EntityFiles } from "@/components/files/entity-files";
import { WhatsappForm } from "@/components/whatsapp/whatsapp-form";
import { WhatsappActionBar } from "@/components/whatsapp/whatsapp-actions";
import { BrandChip, CountryChip, UserChip } from "@/components/entity-chips";
import { formatDate, formatDateTime, formatNumber } from "@/lib/format";
import { getServerI18n } from "@/lib/server-i18n";

export const metadata: Metadata = { title: "WhatsApp campaign" };

function isoDate(d: Date | null | undefined): string {
  return d ? new Date(d).toISOString().slice(0, 10) : "";
}

export default async function WhatsappDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { principal, locale } = await pageGuard("whatsapp.view");
  const { t } = await getServerI18n();
  const { id } = await params;

  let data;
  try {
    data = await getWhatsappCampaign(principal, id);
  } catch (e) {
    if (e instanceof ForbiddenError) return <AccessDenied locale={locale} />;
    throw e;
  }
  if (!data) notFound();
  const { wa, results } = data;

  const canEdit = canAnywhere(principal, "whatsapp.edit");
  const canApprove = can(principal, "whatsapp.approve", { brandId: wa.brandId, countryId: wa.countryId });
  const [lookups, activity, options] = await Promise.all([
    getLookups(),
    getActivity("WhatsappCampaign", id),
    canEdit ? getScopedOptions(principal, "whatsapp.edit") : Promise.resolve(null),
  ]);
  const timeline: TimelineEntry[] = activity.map((a) => ({
    id: a.id, at: a.at, actorName: a.actorId ? refName(lookups.users, a.actorId) : t("common.system"),
    actorColor: a.actorId ? lookups.users.get(a.actorId)?.meta : null, action: a.action, summary: a.summary,
  }));

  return (
    <>
      <div className="mb-1 text-xs text-ink-3"><Link href="/whatsapp" className="hover:text-ink-2">{t("wa.title")}</Link> / {wa.objective ?? t("wa.campaignFallback")}</div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#25D366]/15 text-[#128C7E]"><MessageCircle className="h-5 w-5" /></div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-ink">{wa.objective ?? t("wa.campaignFallback")}</h1>
            <div className="mt-0.5 flex items-center gap-2 text-xs text-ink-3">
              <BrandChip name={refName(lookups.brands, wa.brandId)} color={wa.brandId ? lookups.brands.get(wa.brandId)?.meta : null} />
              <CountryChip name={refName(lookups.countries, wa.countryId)} iso2={wa.countryId ? lookups.countries.get(wa.countryId)?.meta : null} />
              <StatusBadge module="generic" status={wa.status} />
            </div>
          </div>
        </div>
        {canEdit && options && (
          <WhatsappForm
            mode="edit"
            options={{ brands: options.brands, countries: options.countries, users: options.users }}
            defaults={{ id: wa.id, audience: wa.audience, objective: wa.objective, messageCopy: wa.messageCopy, plannedDate: isoDate(wa.plannedDate), responsibleUserId: wa.responsibleUserId }}
          />
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Panel>
            <PanelHeader title={t("wa.brief")} />
            <PanelBody className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-[13px]">
                <div><div className="text-ink-3 text-xs">{t("wa.audience")}</div><div className="text-ink">{wa.audience ?? "—"}</div></div>
                <div><div className="text-ink-3 text-xs">{t("wa.planned")}</div><div className="text-ink">{formatDate(wa.plannedDate, locale)}</div></div>
                <div><div className="text-ink-3 text-xs">{t("wa.responsible")}</div><div>{wa.responsibleUserId ? <UserChip name={refName(lookups.users, wa.responsibleUserId)} color={lookups.users.get(wa.responsibleUserId)?.meta} /> : "—"}</div></div>
                <div><div className="text-ink-3 text-xs">{t("wa.sentAt")}</div><div className="text-ink">{wa.sentAt ? formatDateTime(wa.sentAt, locale) : "—"}</div></div>
              </div>
              {wa.messageCopy && <div><div className="text-[11px] font-semibold uppercase tracking-wide text-ink-3">{t("wa.message")}</div><p className="mt-1 rounded-md border border-line bg-surface-2/40 p-2.5 text-[13px] text-ink whitespace-pre-line">{wa.messageCopy}</p></div>}
            </PanelBody>
          </Panel>

          {results && (
            <Panel>
              <PanelHeader title={t("wa.results")} description={t("wa.resultsSub")} />
              <PanelBody className="grid grid-cols-3 gap-4 sm:grid-cols-6">
                <Metric label={t("wa.sent")} value={formatNumber(results.sent ?? 0, locale)} />
                <Metric label={t("wa.delivered")} value={formatNumber(results.delivered ?? 0, locale)} />
                <Metric label={t("wa.read")} value={formatNumber(results.read ?? 0, locale)} />
                <Metric label={t("wa.replied")} value={formatNumber(results.replied ?? 0, locale)} category="success" />
                <Metric label={t("wa.optOuts")} value={formatNumber(results.optOut ?? 0, locale)} category={Number(results.optOut ?? 0) > 0 ? "warning" : "neutral"} />
                <Metric label={t("wa.conversions")} value={formatNumber(results.conversions ?? 0, locale)} category="success" />
              </PanelBody>
            </Panel>
          )}

          <Panel>
            <PanelHeader title={t("common.activity")} />
            <PanelBody><ActivityTimeline entries={timeline} locale={locale} empty={t("common.noActivity")} /></PanelBody>
          </Panel>
          <EntityFiles principal={principal} entityType="WhatsappCampaign" entityId={wa.id} scope={{ brandId: wa.brandId, countryId: wa.countryId }} />
        </div>

        <div className="space-y-4">
          {canEdit ? (
            <Panel>
              <PanelHeader title={t("wa.workflow")} />
              <PanelBody><WhatsappActionBar waId={wa.id} status={wa.status} canApprove={canApprove} /></PanelBody>
            </Panel>
          ) : (
            <Panel><PanelBody><EmptyState title={t("wa.readOnly")} description={t("wa.readOnlyBody")} /></PanelBody></Panel>
          )}
        </div>
      </div>
    </>
  );
}
