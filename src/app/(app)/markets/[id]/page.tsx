import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { pageGuard } from "@/lib/page-guard";
import { AccessDenied } from "@/components/access-denied";
import { getMarket } from "@/domain/markets";
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
        <Link href="/markets" className="hover:text-ink-2">Markets</Link> <span className="mx-1">/</span> {country.name}
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
              <Badge category={country.isActive ? "success" : "neutral"}>{country.isActive ? "Active" : "Inactive"}</Badge>
              <span>· {country.currency} · {country.region ?? "—"} · {country.timezone}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel>
          <PanelBody>
            <div className="grid grid-cols-3 gap-4">
              <Metric label="Active brands" value={activeBrands} sub={`${brandMarkets.length} total`} category={activeBrands > 0 ? "success" : "neutral"} />
              <Metric label="Registrations" value={registrationCount} />
              <Metric label="Documents" value={documentCount} />
            </div>
          </PanelBody>
        </Panel>
        <Panel className="lg:col-span-2">
          <PanelHeader title="Market profile" description="Regional and regulatory context" />
          <dl className="grid grid-cols-2 gap-px bg-line sm:grid-cols-4">
            <Field label="Currency" value={<span className="font-mono">{country.currency}</span>} />
            <Field label="Region" value={country.region ?? "—"} />
            <Field label="Timezone" value={country.timezone} />
            <Field label="Dial code" value={country.phoneCode ? `+${country.phoneCode.replace(/^\+/, "")}` : "—"} />
          </dl>
        </Panel>
      </div>

      <Panel>
        <PanelHeader title="Brands operating here" description="Brands with a launched or planned presence in this market" />
        <DataTable
          columns={[
            { key: "brand", header: "Brand", render: (bm) => <BrandChip name={refName(lookups.brands, bm.brandId)} color={lookups.brands.get(bm.brandId)?.meta} /> },
            { key: "status", header: "Status", render: (bm) => <Badge category={bm.status === "active" ? "success" : "neutral"}>{bm.status}</Badge> },
            { key: "launched", header: "Launched", align: "end", render: (bm) => formatDate(bm.launchedAt, locale) },
          ] as Column<(typeof brandMarkets)[number]>[]}
          rows={brandMarkets}
          getRowKey={(bm) => bm.id}
          getRowHref={(bm) => `/brands/${bm.brandId}`}
          empty={<EmptyState title="No brands in this market" description="No brand operates in this country yet. Add a market to a brand from its Overview to begin tracking registrations and documents here." />}
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
