import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { pageGuard } from "@/lib/page-guard";
import { AccessDenied } from "@/components/access-denied";
import { ForbiddenError, canAnywhere, can } from "@/lib/permissions/engine";
import { getProduct } from "@/domain/products";
import { getServerI18n } from "@/lib/server-i18n";
import { getScopedOptions } from "@/domain/options";
import { getLookups, refName } from "@/domain/lookups";
import { Panel, PanelHeader, PanelBody, DataTable, StatusBadge, Badge, TabBar, EmptyState, Metric, type Column, type TabItem } from "@/components/ui";
import { BrandChip, CountryChip } from "@/components/entity-chips";
import { ProductForm, ArchiveProductButton, ProductVariants, ProductMarkets, ProductClaims } from "@/components/products/product-controls";
import { formatDate, formatCurrency } from "@/lib/format";
import { daysUntil } from "@/lib/utils";

function isoDate(d: Date | null | undefined): string { return d ? new Date(d).toISOString().slice(0, 10) : ""; }

export const metadata: Metadata = { title: "Product" };

export default async function ProductDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string>>;
}) {
  const { principal, locale } = await pageGuard("products.view");
  const { t } = await getServerI18n();
  const { id } = await params;
  const tab = (await searchParams).tab ?? "overview";

  let data;
  try {
    data = await getProduct(principal, id);
  } catch (err) {
    if (err instanceof ForbiddenError) return <AccessDenied locale={locale} />;
    throw err;
  }
  if (!data) notFound();

  const { product, variants, markets, claims, campaigns, registrations, documents, cases } = data;
  const canEdit = can(principal, "products.edit", { brandId: product.brandId });
  const canApprove = can(principal, "products.manage", { brandId: product.brandId });
  const [lookups, options] = await Promise.all([getLookups(), canEdit ? getScopedOptions(principal, "products.edit") : Promise.resolve(null)]);
  const brandColor = lookups.brands.get(product.brandId)?.meta;
  const countryOptions = [...lookups.countries.values()].sort((a, b) => a.name.localeCompare(b.name)).map((c) => ({ id: c.id, label: c.name }));

  const tabs: TabItem[] = [
    { key: "overview", label: t("detail.tab.overview") },
    { key: "markets", label: t("detail.markets"), count: markets.length },
    { key: "regulatory", label: t("detail.tab.regulatory"), count: registrations.length },
    { key: "documents", label: t("detail.tab.documents"), count: documents.length },
    { key: "campaigns", label: t("detail.tab.campaigns"), count: campaigns.length },
    { key: "support", label: t("detail.tab.support"), count: cases.length },
  ];

  return (
    <>
      {/* 360 header (§44) */}
      <div className="mb-1 text-xs text-ink-3">
        <Link href="/products" className="hover:text-ink-2">{t("detail.tab.products")}</Link> <span className="mx-1">/</span> {product.name}
      </div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl text-lg font-bold text-white shadow-sm" style={{ background: brandColor ?? "var(--accent)" }}>
            {product.name[0]}
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-ink">{product.name}</h1>
            <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-ink-3">
              <span className="font-mono">{product.sku}</span>
              <StatusBadge module="generic" status={product.status} />
              <span>·</span>
              <BrandChip name={refName(lookups.brands, product.brandId)} color={brandColor} />
              <span>· {markets.length} markets</span>
            </div>
          </div>
        </div>
        {canEdit && options && (
          <div className="flex items-center gap-2">
            <ProductForm mode="edit" brands={options.brands} defaults={{ id: product.id, brandId: product.brandId, name: product.name, sku: product.sku, barcode: product.barcode, category: product.category, description: product.description, status: product.status, launchDate: isoDate(product.launchDate) }} />
            <ArchiveProductButton productId={product.id} />
          </div>
        )}
      </div>

      <TabBar tabs={tabs} current={tab} className="mb-4" />

      {tab === "overview" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Panel className="lg:col-span-2">
              <PanelHeader title={t("detail.profile")} description={t("prod.profileSub")} />
              <dl className="grid grid-cols-1 gap-px bg-line sm:grid-cols-2">
                <Field label={t("common.brand")} value={<BrandChip name={refName(lookups.brands, product.brandId)} color={brandColor} />} />
                <Field label="SKU" value={<span className="font-mono">{product.sku}</span>} />
                <Field label={t("prod.barcode")} value={product.barcode ? <span className="font-mono">{product.barcode}</span> : "—"} />
                <Field label={t("common.category")} value={product.category ?? "—"} />
                <Field label={t("prod.launchDate")} value={formatDate(product.launchDate, locale)} />
                <Field label={t("common.status")} value={<StatusBadge module="generic" status={product.status} />} />
                <Field label={t("common.created")} value={formatDate(product.createdAt, locale)} />
                <Field label={t("common.updated")} value={formatDate(product.updatedAt, locale)} />
              </dl>
              {product.description && (
                <PanelBody className="border-t border-line">
                  <p className="text-[13px] leading-relaxed text-ink-2">{product.description}</p>
                </PanelBody>
              )}
            </Panel>
            <Panel>
              <PanelHeader title={t("detail.atAGlance")} description={t("prod.atAGlanceSub")} />
              <PanelBody>
                <div className="grid grid-cols-2 gap-4">
                  <Metric label={t("detail.markets")} value={markets.length} />
                  <Metric label={t("prod.variants")} value={variants.length} />
                  <Metric label={t("detail.registrations")} value={registrations.length} />
                  <Metric label={t("detail.tab.campaigns")} value={campaigns.length} />
                </div>
              </PanelBody>
            </Panel>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Panel>
              <PanelHeader title={t("prod.variants")} description={t("prod.variantsSub")} />
              <PanelBody><ProductVariants productId={product.id} variants={variants} editable={canEdit} /></PanelBody>
            </Panel>
            <Panel>
              <PanelHeader title={t("prod.claims")} description={t("prod.claimsSub")} />
              <PanelBody><ProductClaims productId={product.id} claims={claims} countries={countryOptions} editable={canEdit} canApprove={canApprove} /></PanelBody>
            </Panel>
          </div>
        </div>
      )}

      {tab === "markets" && (
        <Panel>
          <PanelHeader title={t("prod.marketAvailability")} description={t("prod.marketAvailabilitySub")} />
          <PanelBody><ProductMarkets productId={product.id} markets={markets} countries={countryOptions} editable={canEdit} /></PanelBody>
        </Panel>
      )}

      {tab === "regulatory" && (
        <Panel>
          <DataTable
            columns={[
              { key: "country", header: t("common.market"), render: (r) => <CountryChip name={refName(lookups.countries, r.countryId)} iso2={lookups.countries.get(r.countryId)?.meta} /> },
              { key: "number", header: t("detail.regNumber"), render: (r) => <span className="font-mono text-xs">{r.registrationNumber ?? "—"}</span> },
              { key: "status", header: t("common.status"), render: (r) => <StatusBadge module="registration" status={r.status} /> },
              { key: "expiry", header: t("detail.expiry"), align: "end", render: (r) => formatDate(r.expiryDate, locale) },
            ] as Column<(typeof registrations)[number]>[]}
            rows={registrations}
            getRowKey={(r) => r.id}
            getRowHref={(r) => `/registrations/${r.id}`}
            empty={<EmptyState title={t("detail.noRegCases")} description={t("prod.noRegBody")} />}
          />
        </Panel>
      )}

      {tab === "documents" && (
        <Panel>
          <DataTable
            columns={[
              { key: "title", header: t("detail.document"), render: (d) => d.title },
              { key: "country", header: t("common.market"), render: (d) => <CountryChip name={refName(lookups.countries, d.countryId)} iso2={lookups.countries.get(d.countryId ?? "")?.meta} /> },
              { key: "expiry", header: t("common.expiry"), render: (d) => {
                const days = daysUntil(d.expiryDate);
                return <span className={days !== null && days < 30 ? "text-critical" : "text-ink"}>{formatDate(d.expiryDate, locale)}{days !== null && days >= 0 && days < 60 ? ` · ${days}d` : ""}</span>;
              } },
              { key: "status", header: t("common.status"), align: "end", render: (d) => <StatusBadge module="document" status={d.status} /> },
            ] as Column<(typeof documents)[number]>[]}
            rows={documents}
            getRowKey={(d) => d.id}
            empty={<EmptyState title={t("detail.noDocuments")} description={t("prod.noDocsBody")} />}
          />
        </Panel>
      )}

      {tab === "campaigns" && (
        <Panel>
          <DataTable
            columns={[
              { key: "name", header: t("detail.campaign"), render: (c) => c.name },
              { key: "country", header: t("common.market"), render: (c) => <CountryChip name={refName(lookups.countries, c.countryId)} iso2={lookups.countries.get(c.countryId ?? "")?.meta} /> },
              { key: "type", header: t("common.type"), render: (c) => <span className="capitalize">{c.type}</span> },
              { key: "budget", header: t("detail.budget"), align: "end", render: (c) => formatCurrency(c.plannedBudget, c.currency, locale) },
              { key: "status", header: t("common.status"), render: (c) => <StatusBadge module="campaign" status={c.status} /> },
            ] as Column<(typeof campaigns)[number]>[]}
            rows={campaigns}
            getRowKey={(c) => c.id}
            getRowHref={(c) => `/campaigns/${c.id}`}
            empty={<EmptyState title={t("detail.noCampaigns")} description={t("prod.noCampaignsBody")} />}
          />
        </Panel>
      )}

      {tab === "support" && (
        <Panel>
          <DataTable
            columns={[
              { key: "type", header: t("common.type"), render: (c) => <span className="capitalize">{c.type.replace(/_/g, " ")}</span> },
              { key: "desc", header: t("detail.summary"), render: (c) => <span className="text-ink-2">{c.description ?? "—"}</span> },
              { key: "priority", header: t("common.priority"), render: (c) => <span className="capitalize">{c.priority}</span> },
              { key: "status", header: t("common.status"), align: "end", render: (c) => <StatusBadge module="customer_case" status={c.status} /> },
            ] as Column<(typeof cases)[number]>[]}
            rows={cases}
            getRowKey={(c) => c.id}
            getRowHref={(c) => `/cases/${c.id}`}
            empty={<EmptyState title={t("detail.noCustomerCases")} description={t("prod.noCasesBody")} />}
          />
        </Panel>
      )}
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
