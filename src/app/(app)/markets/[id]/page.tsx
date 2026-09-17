import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { pageGuard } from "@/lib/page-guard";
import { AccessDenied } from "@/components/access-denied";
import { getMarket } from "@/domain/markets";
import { getServerI18n } from "@/lib/server-i18n";
import { getLookups, refName } from "@/domain/lookups";
import { Panel, PanelHeader, PanelBody, DataTable, Badge, Metric, EmptyState, type Column } from "@/components/ui";
import { BrandChip } from "@/components/entity-chips";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Market" };

/** Emoji flag from an ISO-3166 alpha-2 code (KW → 🇰🇼). */
function flag(iso2?: string | null): string {
  if (!iso2 || iso2.length !== 2) return "🌐";
  const base = 0x1f1e6;
  return String.fromCodePoint(...[...iso2.toUpperCase()].map((c) => base + c.charCodeAt(0) - 65));
}

export default async function MarketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { locale, denied } = await pageGuard("markets.view");
  if (denied) return <AccessDenied locale={locale} />;
  const { t } = await getServerI18n();

  const { id } = await params;
  const data = await getMarket(id);
  if (!data) notFound();

  const { country, brandMarkets, registrationCount, documentCount } = data;
  const lookups = await getLookups();

  const activeBrands = brandMarkets.filter((bm) => bm.status === "active").length;

  return (
    <>
      {/* 360 header (§44) */}
      <div className="mb-1 text-xs text-ink-3">
        <Link href="/markets" className="hover:text-ink-2">{t("detail.markets")}</Link> <span className="mx-1">/</span> {country.name}
      </div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-surface-2 text-2xl shadow-sm" aria-hidden>
            {flag(country.iso2)}
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-ink">{country.name}</h1>
            <div className="mt-0.5 flex items-center gap-2 text-xs text-ink-3">
              <span className="font-mono">{country.iso2}</span>
              <Badge category={country.isActive ? "success" : "neutral"}>{country.isActive ? t("detail.activeCap") : t("detail.inactiveCap")}</Badge>
              <span>· {country.currency} · {country.region ?? "—"} · {country.timezone}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel>
          <PanelBody>
            <div className="grid grid-cols-3 gap-4">
              <Metric label={t("detail.activeBrands")} value={activeBrands} sub={t("detail.totalCount", { count: brandMarkets.length })} category={activeBrands > 0 ? "success" : "neutral"} />
              <Metric label={t("detail.registrations")} value={registrationCount} />
              <Metric label={t("detail.documents")} value={documentCount} />
            </div>
          </PanelBody>
        </Panel>
        <Panel className="lg:col-span-2">
          <PanelHeader title={t("detail.marketProfile")} description={t("detail.marketProfileSub")} />
          <dl className="grid grid-cols-2 gap-px bg-line sm:grid-cols-4">
            <Field label={t("common.currency")} value={<span className="font-mono">{country.currency}</span>} />
            <Field label={t("detail.region")} value={country.region ?? "—"} />
            <Field label={t("common.timezone")} value={country.timezone} />
            <Field label={t("detail.dialCode")} value={country.phoneCode ? `+${country.phoneCode.replace(/^\+/, "")}` : "—"} />
          </dl>
        </Panel>
      </div>

      <Panel>
        <PanelHeader title={t("detail.brandsOperatingHere")} description={t("detail.brandsOperatingSub")} />
        <DataTable
          columns={[
            { key: "brand", header: t("detail.brand"), render: (bm) => <BrandChip name={refName(lookups.brands, bm.brandId)} color={lookups.brands.get(bm.brandId)?.meta} /> },
            { key: "status", header: t("common.status"), render: (bm) => <Badge category={bm.status === "active" ? "success" : "neutral"}>{t(`status.${bm.status}`)}</Badge> },
            { key: "launched", header: t("detail.launched"), align: "end", render: (bm) => formatDate(bm.launchedAt, locale) },
          ] as Column<(typeof brandMarkets)[number]>[]}
          rows={brandMarkets}
          getRowKey={(bm) => bm.id}
          getRowHref={(bm) => `/brands/${bm.brandId}`}
          empty={<EmptyState title={t("detail.noBrandsMarket")} description={t("detail.noBrandsMarketBody")} />}
        />
      </Panel>
    </>
  );
}

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="bg-surface px-4 py-3">
      <dt className="text-xs text-ink-3">{label}</dt>
      <dd className="mt-1 text-[13px] text-ink">{value}</dd>
    </div>
  );
}
