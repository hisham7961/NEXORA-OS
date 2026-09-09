import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { pageGuard } from "@/lib/page-guard";
import { AccessDenied } from "@/components/access-denied";
import { ForbiddenError } from "@/lib/permissions/engine";
import { getProduct } from "@/domain/products";
import { getLookups, refName } from "@/domain/lookups";
import { Panel, PanelHeader, PanelBody, DataTable, StatusBadge, Badge, TabBar, EmptyState, Metric, type Column, type TabItem } from "@/components/ui";
import { BrandChip, CountryChip } from "@/components/entity-chips";
import { formatDate, formatCurrency } from "@/lib/format";
import { daysUntil } from "@/lib/utils";

export const metadata: Metadata = { title: "Product" };

export default async function ProductDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string>>;
}) {
  const { principal, locale } = await pageGuard("products.view");
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
  const lookups = await getLookups();
  const brandColor = lookups.brands.get(product.brandId)?.meta;

  const tabs: TabItem[] = [
    { key: "overview", label: "Overview" },
    { key: "markets", label: "Markets", count: markets.length },
    { key: "regulatory", label: "Regulatory", count: registrations.length },
    { key: "documents", label: "Documents", count: documents.length },
    { key: "campaigns", label: "Campaigns", count: campaigns.length },
    { key: "support", label: "Customer Support", count: cases.length },
  ];

  return (
    <>
      {/* 360 header (§44) */}
      <div className="mb-1 text-xs text-ink-3">
        <Link href="/products" className="hover:text-ink-2">Products</Link> <span className="mx-1">/</span> {product.name}
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
      </div>

      <TabBar tabs={tabs} current={tab} className="mb-4" />

      {tab === "overview" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Panel className="lg:col-span-2">
              <PanelHeader title="Profile" description="Identity and classification of this product" />
              <dl className="grid grid-cols-1 gap-px bg-line sm:grid-cols-2">
                <Field label="Brand" value={<BrandChip name={refName(lookups.brands, product.brandId)} color={brandColor} />} />
                <Field label="SKU" value={<span className="font-mono">{product.sku}</span>} />
                <Field label="Barcode" value={product.barcode ? <span className="font-mono">{product.barcode}</span> : "—"} />
                <Field label="Category" value={product.category ?? "—"} />
                <Field label="Launch date" value={formatDate(product.launchDate, locale)} />
                <Field label="Status" value={<StatusBadge module="generic" status={product.status} />} />
                <Field label="Created" value={formatDate(product.createdAt, locale)} />
                <Field label="Updated" value={formatDate(product.updatedAt, locale)} />
              </dl>
              {product.description && (
                <PanelBody className="border-t border-line">
                  <p className="text-[13px] leading-relaxed text-ink-2">{product.description}</p>
                </PanelBody>
              )}
            </Panel>
            <Panel>
              <PanelHeader title="At a glance" description="Reach of this product" />
              <PanelBody>
                <div className="grid grid-cols-2 gap-4">
                  <Metric label="Markets" value={markets.length} />
                  <Metric label="Variants" value={variants.length} />
                  <Metric label="Registrations" value={registrations.length} />
                  <Metric label="Campaigns" value={campaigns.length} />
                </div>
              </PanelBody>
            </Panel>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Panel>
              <PanelHeader title="Variants" description="Pack sizes and shades sold under this product" />
              <ul className="divide-y divide-line">
                {variants.map((v) => (
                  <li key={v.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <div className="min-w-0">
                      <div className="text-[13px] text-ink">{v.name}</div>
                      {v.sku && <div className="text-xs text-ink-3 font-mono">{v.sku}</div>}
                    </div>
                    {v.size && <span className="text-xs text-ink-3">{v.size}</span>}
                  </li>
                ))}
                {variants.length === 0 && (
                  <li className="px-4 py-6 text-sm text-ink-3">No variants — this product is sold as a single SKU. Add variants when pack sizes or shades differ.</li>
                )}
              </ul>
            </Panel>
            <Panel>
              <PanelHeader title="Claims" description="Approved marketing and regulatory claims by market" />
              <ul className="divide-y divide-line">
                {claims.map((c) => (
                  <li key={c.id} className="flex items-start justify-between gap-3 px-4 py-2.5">
                    <div className="min-w-0">
                      <div className="text-[13px] text-ink">{c.claim}</div>
                      <div className="mt-0.5 text-xs text-ink-3">
                        {c.countryId ? refName(lookups.countries, c.countryId) : "All markets"}
                      </div>
                    </div>
                    <Badge category={c.isApproved ? "success" : "warning"}>{c.isApproved ? "Approved" : "Pending"}</Badge>
                  </li>
                ))}
                {claims.length === 0 && (
                  <li className="px-4 py-6 text-sm text-ink-3">No claims recorded. Claims control what may be said about this product per market — add and approve them before use.</li>
                )}
              </ul>
            </Panel>
          </div>
        </div>
      )}

      {tab === "markets" && (
        <Panel>
          <DataTable
            columns={[
              { key: "country", header: "Market", render: (m) => <CountryChip name={refName(lookups.countries, m.countryId)} iso2={lookups.countries.get(m.countryId)?.meta} /> },
              { key: "status", header: "Status", align: "end", render: (m) => <StatusBadge module="generic" status={m.status} /> },
            ] as Column<(typeof markets)[number]>[]}
            rows={markets}
            getRowKey={(m) => m.id}
            empty={<EmptyState title="No markets" description="The countries where this product is planned or sold will appear here. Add a market to start its regulatory and go-to-market work." />}
          />
        </Panel>
      )}

      {tab === "regulatory" && (
        <Panel>
          <DataTable
            columns={[
              { key: "country", header: "Market", render: (r) => <CountryChip name={refName(lookups.countries, r.countryId)} iso2={lookups.countries.get(r.countryId)?.meta} /> },
              { key: "number", header: "Reg. number", render: (r) => <span className="font-mono text-xs">{r.registrationNumber ?? "—"}</span> },
              { key: "status", header: "Status", render: (r) => <StatusBadge module="registration" status={r.status} /> },
              { key: "expiry", header: "Expiry", align: "end", render: (r) => formatDate(r.expiryDate, locale) },
            ] as Column<(typeof registrations)[number]>[]}
            rows={registrations}
            getRowKey={(r) => r.id}
            getRowHref={(r) => `/registrations/${r.id}`}
            empty={<EmptyState title="No registration cases" description="This product has no regulatory registrations. A product must be registered with the authority before it can legally sell in a market." />}
          />
        </Panel>
      )}

      {tab === "documents" && (
        <Panel>
          <DataTable
            columns={[
              { key: "title", header: "Document", render: (d) => d.title },
              { key: "country", header: "Market", render: (d) => <CountryChip name={refName(lookups.countries, d.countryId)} iso2={lookups.countries.get(d.countryId ?? "")?.meta} /> },
              { key: "expiry", header: "Expiry", render: (d) => {
                const days = daysUntil(d.expiryDate);
                return <span className={days !== null && days < 30 ? "text-critical" : "text-ink"}>{formatDate(d.expiryDate, locale)}{days !== null && days >= 0 && days < 60 ? ` · ${days}d` : ""}</span>;
              } },
              { key: "status", header: "Status", align: "end", render: (d) => <StatusBadge module="document" status={d.status} /> },
            ] as Column<(typeof documents)[number]>[]}
            rows={documents}
            getRowKey={(d) => d.id}
            empty={<EmptyState title="No documents" description="Certificates and compliance documents linked to this product will appear here, with expiry tracking so nothing lapses unnoticed." />}
          />
        </Panel>
      )}

      {tab === "campaigns" && (
        <Panel>
          <DataTable
            columns={[
              { key: "name", header: "Campaign", render: (c) => c.name },
              { key: "country", header: "Market", render: (c) => <CountryChip name={refName(lookups.countries, c.countryId)} iso2={lookups.countries.get(c.countryId ?? "")?.meta} /> },
              { key: "type", header: "Type", render: (c) => <span className="capitalize">{c.type}</span> },
              { key: "budget", header: "Budget", align: "end", render: (c) => formatCurrency(c.plannedBudget, c.currency, locale) },
              { key: "status", header: "Status", render: (c) => <StatusBadge module="campaign" status={c.status} /> },
            ] as Column<(typeof campaigns)[number]>[]}
            rows={campaigns}
            getRowKey={(c) => c.id}
            getRowHref={(c) => `/campaigns/${c.id}`}
            empty={<EmptyState title="No campaigns" description="Marketing campaigns that feature this product will appear here. Link a product to a campaign to see it surface on this tab." />}
          />
        </Panel>
      )}

      {tab === "support" && (
        <Panel>
          <DataTable
            columns={[
              { key: "type", header: "Type", render: (c) => <span className="capitalize">{c.type.replace(/_/g, " ")}</span> },
              { key: "desc", header: "Summary", render: (c) => <span className="text-ink-2">{c.description ?? "—"}</span> },
              { key: "priority", header: "Priority", render: (c) => <span className="capitalize">{c.priority}</span> },
              { key: "status", header: "Status", align: "end", render: (c) => <StatusBadge module="customer_case" status={c.status} /> },
            ] as Column<(typeof cases)[number]>[]}
            rows={cases}
            getRowKey={(c) => c.id}
            getRowHref={(c) => `/cases/${c.id}`}
            empty={<EmptyState title="No customer cases" description="Complaints, questions and returns raised about this product will appear here, so recurring issues are visible against the SKU." />}
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
