import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { CreditCard, RefreshCw } from "lucide-react";
import { pageGuard } from "@/lib/page-guard";
import { AccessDenied } from "@/components/access-denied";
import { canAnywhere, ForbiddenError } from "@/lib/permissions/engine";
import { getSubscription } from "@/domain/subscriptions";
import { getServerI18n } from "@/lib/server-i18n";
import { getActivity } from "@/domain/mutation";
import { getScopedOptions } from "@/domain/options";
import { getLookups, refName } from "@/domain/lookups";
import { Panel, PanelHeader, PanelBody, StatusBadge, Badge } from "@/components/ui";
import { ActivityTimeline, type TimelineEntry } from "@/components/activity-timeline";
import { SubscriptionForm, SubscriptionActions } from "@/components/subscriptions/subscription-controls";
import { EntityFiles } from "@/components/files/entity-files";
import { BrandChip, UserChip } from "@/components/entity-chips";
import { formatCurrency, formatDate } from "@/lib/format";
import { daysUntil } from "@/lib/utils";

export const metadata: Metadata = { title: "Subscription" };

function isoDate(d: Date | null | undefined): string { return d ? new Date(d).toISOString().slice(0, 10) : ""; }

export default async function SubscriptionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { principal, locale } = await pageGuard("subscriptions.view");
  const { t } = await getServerI18n();
  const { id } = await params;
  let s;
  try {
    s = await getSubscription(principal, id);
  } catch (e) {
    if (e instanceof ForbiddenError) return <AccessDenied locale={locale} />;
    throw e;
  }
  if (!s) notFound();

  const canEdit = canAnywhere(principal, "subscriptions.edit");
  const showValues = canAnywhere(principal, "finance.view_values");
  const [activity, lookups, options] = await Promise.all([
    getActivity("Subscription", id),
    getLookups(),
    canEdit ? getScopedOptions(principal, "subscriptions.edit") : Promise.resolve(null),
  ]);
  const timeline: TimelineEntry[] = activity.map((a) => ({
    id: a.id, at: a.at, actorName: a.actorId ? refName(lookups.users, a.actorId) : t("common.system"),
    actorColor: a.actorId ? lookups.users.get(a.actorId)?.meta : null, action: a.action, summary: a.summary,
  }));
  const dLeft = daysUntil(s.renewalDate);

  return (
    <>
      <div className="mb-1 text-xs text-ink-3"><Link href="/subscriptions" className="hover:text-ink-2">{t("subf.subscriptions")}</Link> / {s.provider}</div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-accent"><CreditCard className="h-5 w-5" /></div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-ink">{s.provider}{s.plan ? ` · ${s.plan}` : ""}</h1>
            <div className="mt-0.5 flex items-center gap-2 text-xs text-ink-3">
              <StatusBadge module="subscription" status={s.status} />
              <span className="capitalize">{s.billingCycle}</span>
              {s.autoRenew && <Badge category="info">{t("subf.autoRenew")}</Badge>}
              {dLeft !== null && dLeft < 14 && dLeft >= 0 && <Badge category="warning">{t("subf.renewsIn", { days: dLeft })}</Badge>}
            </div>
          </div>
        </div>
        {canEdit && options && (
          <SubscriptionForm mode="edit" options={{ brands: options.brands, countries: options.countries, companies: options.companies, users: options.users }}
            defaults={{ id: s.id, provider: s.provider, plan: s.plan, ownerId: s.ownerId, currency: s.currency, cost: s.cost != null ? String(s.cost) : "", billingCycle: s.billingCycle, renewalDate: isoDate(s.renewalDate), autoRenew: s.autoRenew, paymentMethodRef: s.paymentMethodRef, licenses: s.licenses != null ? String(s.licenses) : "", notes: s.notes }} />
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Panel>
            <PanelHeader title={t("subf.details")} />
            <PanelBody>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-[13px]">
                <Row label={t("common.company")}><span className="text-ink">{refName(lookups.companies, s.companyId)}</span></Row>
                <Row label={t("common.brand")}><BrandChip name={refName(lookups.brands, s.brandId)} color={s.brandId ? lookups.brands.get(s.brandId)?.meta : null} /></Row>
                <Row label={t("camp.owner")}>{s.ownerId ? <UserChip name={refName(lookups.users, s.ownerId)} color={lookups.users.get(s.ownerId)?.meta} /> : "—"}</Row>
                <Row label={t("subf.cost")}>{showValues ? <span className="font-medium text-ink">{formatCurrency(s.cost, s.currency, locale)}</span> : <span className="text-ink-3">{t("subf.hidden")}</span>}</Row>
                <Row label={t("subf.renewal")}><span className="text-ink">{formatDate(s.renewalDate, locale)}</span></Row>
                <Row label={t("subf.licenses")}><span className="text-ink">{s.licenses ?? "—"}</span></Row>
                <Row label={t("subf.paymentRefShort")}><span className="text-ink-2">{s.paymentMethodRef ?? "—"}</span></Row>
                <Row label={t("subf.autoRenew")}><span className="text-ink">{s.autoRenew ? t("subf.yes") : t("subf.no")}</span></Row>
              </dl>
              {s.notes && <p className="mt-3 rounded-md bg-surface-2/50 p-2.5 text-[13px] text-ink-2 whitespace-pre-line">{s.notes}</p>}
            </PanelBody>
          </Panel>
          <Panel>
            <PanelHeader title={t("subf.activity")} />
            <PanelBody><ActivityTimeline entries={timeline} locale={locale} empty={t("subf.noActivity")} /></PanelBody>
          </Panel>
        </div>
        <div className="space-y-4">
          {canEdit && (
            <Panel>
              <PanelHeader title={t("subf.actions")} icon={<RefreshCw className="h-4 w-4" />} description={t("subf.actionsSub")} />
              <PanelBody><SubscriptionActions subscriptionId={s.id} status={s.status} /></PanelBody>
            </Panel>
          )}
          <EntityFiles principal={principal} entityType="Subscription" entityId={s.id} scope={{ companyId: s.companyId, brandId: s.brandId, countryId: s.countryId }} title={t("subf.contractsInvoices")} />
        </div>
      </div>
    </>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (<div><dt className="text-ink-3">{label}</dt><dd className="mt-0.5">{children}</dd></div>);
}
