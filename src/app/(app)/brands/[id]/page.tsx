import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { pageGuard } from "@/lib/page-guard";
import { AccessDenied } from "@/components/access-denied";
import { ForbiddenError, canAnywhere } from "@/lib/permissions/engine";
import { getBrand } from "@/domain/brands";
import { getLookups, refName } from "@/domain/lookups";
import { Panel, PanelHeader, DataTable, StatusBadge, Badge, TabBar, EmptyState, type Column, type TabItem } from "@/components/ui";
import { BrandChip, CountryChip } from "@/components/entity-chips";
import { BrandForm, ArchiveOrgButton } from "@/components/org/org-forms";
import { FavoriteStar, RecordRecent } from "@/components/personal/bookmarks";
import { formatDate, formatCurrency } from "@/lib/format";
import { daysUntil } from "@/lib/utils";

export const metadata: Metadata = { title: "Brand" };

export default async function BrandDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string>>;
}) {
  const { principal, locale } = await pageGuard("brands.view");
  const { id } = await params;
  const tab = (await searchParams).tab ?? "overview";

  let data;
  try {
    data = await getBrand(principal, id);
  } catch (err) {
    if (err instanceof ForbiddenError) return <AccessDenied locale={locale} />;
    throw err;
  }
  if (!data) notFound();

  const { brand, companyLinks, markets, products, campaigns, registrations, documents, cases, openTasks } = data;
  const lookups = await getLookups();
  const { favoritedIds } = await import("@/domain/personal");
  const favorited = (await favoritedIds(principal, "brand")).has(brand.id);

  const tabs: TabItem[] = [
    { key: "overview", label: "Overview" },
    { key: "products", label: "Products", count: products.length },
    { key: "campaigns", label: "Campaigns", count: campaigns.length },
    { key: "regulatory", label: "Regulatory", count: registrations.length },
    { key: "documents", label: "Documents", count: documents.length },
    { key: "customer-service", label: "Customer Service", count: cases.length },
    ...(canAnywhere(principal, "accounting.view") ? [{ key: "financial", label: "Financial" }] : []),
  ];

  return (
    <>
      {/* 360 header (§44) */}
      <div className="mb-1 text-xs text-ink-3">
        <Link href="/brands" className="hover:text-ink-2">Brands</Link> <span className="mx-1">/</span> {brand.name}
      </div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl text-lg font-bold text-white shadow-sm" style={{ background: brand.accentColor ?? "var(--accent)" }}>
            {brand.name[0]}
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-ink">{brand.name}</h1>
            <div className="mt-0.5 flex items-center gap-2 text-xs text-ink-3">
              <span className="font-mono">{brand.code}</span>
              <StatusBadge module="generic" status={brand.status} />
              <span>· {companyLinks.length} companies · {markets.length} markets · {openTasks} open tasks</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <RecordRecent entityType="brand" entityId={brand.id} label={brand.name} href={`/brands/${brand.id}`} />
          <FavoriteStar entityType="brand" entityId={brand.id} label={brand.name} href={`/brands/${brand.id}`} initial={favorited} />
        {canAnywhere(principal, "brands.edit") && (
          <div className="flex items-center gap-2">
            <BrandForm mode="edit" companies={[...lookups.companies.values()].sort((a, b) => a.name.localeCompare(b.name)).map((c) => ({ id: c.id, label: c.name }))} defaults={{ id: brand.id, name: brand.name, code: brand.code, slug: brand.slug, description: brand.description, primaryCompanyId: brand.primaryCompanyId, accentColor: brand.accentColor, status: brand.status }} />
            {canAnywhere(principal, "brands.delete") && <ArchiveOrgButton kind="brand" id={brand.id} redirect="/brands" />}
          </div>
        )}
        </div>
      </div>

      <TabBar tabs={tabs} current={tab} className="mb-4" />

      {tab === "overview" && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Panel className="lg:col-span-2">
            <PanelHeader title="Markets" description="Countries where this brand operates" />
            <ul className="grid grid-cols-2 gap-px bg-line sm:grid-cols-3">
              {markets.map((m) => (
                <li key={m.id} className="bg-surface px-4 py-3">
                  <CountryChip name={refName(lookups.countries, m.countryId)} iso2={lookups.countries.get(m.countryId)?.meta} />
                  <div className="mt-1"><Badge category={m.status === "active" ? "success" : "neutral"}>{m.status}</Badge></div>
                </li>
              ))}
              {markets.length === 0 && <li className="bg-surface px-4 py-6 text-sm text-ink-3">No markets yet.</li>}
            </ul>
          </Panel>
          <Panel>
            <PanelHeader title="Companies" description="Legal entities this brand belongs to" />
            <ul className="divide-y divide-line">
              {companyLinks.map((cl) => (
                <li key={cl.id} className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-[13px] text-ink">{refName(lookups.companies, cl.companyId)}</span>
                  {cl.isPrimary && <Badge category="info">Primary</Badge>}
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      )}

      {tab === "products" && (
        <Panel>
          <DataTable
            columns={[
              { key: "name", header: "Product", render: (p) => p.name },
              { key: "sku", header: "SKU", render: (p) => <span className="font-mono text-xs text-ink-3">{p.sku}</span> },
              { key: "category", header: "Category", render: (p) => p.category ?? "—" },
              { key: "status", header: "Status", render: (p) => <StatusBadge module="generic" status={p.status} /> },
              { key: "launch", header: "Launched", align: "end", render: (p) => formatDate(p.launchDate, locale) },
            ] as Column<(typeof products)[number]>[]}
            rows={products}
            getRowKey={(p) => p.id}
            getRowHref={(p) => `/products/${p.id}`}
            empty={<EmptyState title="No products" description="Products for this brand will appear here." />}
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
            empty={<EmptyState title="No campaigns" description="Marketing campaigns for this brand will appear here." />}
          />
        </Panel>
      )}

      {tab === "regulatory" && (
        <Panel>
          <DataTable
            columns={[
              { key: "product", header: "Product", render: (r) => refName(lookups.products, r.productId) },
              { key: "country", header: "Market", render: (r) => <CountryChip name={refName(lookups.countries, r.countryId)} iso2={lookups.countries.get(r.countryId)?.meta} /> },
              { key: "number", header: "Reg. number", render: (r) => <span className="font-mono text-xs">{r.registrationNumber ?? "—"}</span> },
              { key: "status", header: "Status", render: (r) => <StatusBadge module="registration" status={r.status} /> },
              { key: "expiry", header: "Expiry", align: "end", render: (r) => formatDate(r.expiryDate, locale) },
            ] as Column<(typeof registrations)[number]>[]}
            rows={registrations}
            getRowKey={(r) => r.id}
            getRowHref={(r) => `/registrations/${r.id}`}
            empty={<EmptyState title="No registration cases" description="Regulatory registrations for this brand will appear here." />}
          />
        </Panel>
      )}

      {tab === "documents" && (
        <Panel>
          <DataTable
            columns={[
              { key: "title", header: "Document", render: (d) => d.title },
              { key: "country", header: "Market", render: (d) => refName(lookups.countries, d.countryId) },
              { key: "expiry", header: "Expiry", render: (d) => {
                const days = daysUntil(d.expiryDate);
                return <span className={days !== null && days < 30 ? "text-critical" : "text-ink"}>{formatDate(d.expiryDate, locale)}{days !== null && days >= 0 && days < 60 ? ` · ${days}d` : ""}</span>;
              } },
              { key: "status", header: "Status", align: "end", render: (d) => <StatusBadge module="document" status={d.status} /> },
            ] as Column<(typeof documents)[number]>[]}
            rows={documents}
            getRowKey={(d) => d.id}
            empty={<EmptyState title="No documents" description="Certificates and documents for this brand will appear here." />}
          />
        </Panel>
      )}

      {tab === "customer-service" && (
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
            empty={<EmptyState title="No customer cases" description="Customer service cases for this brand will appear here." />}
          />
        </Panel>
      )}

      {tab === "financial" && canAnywhere(principal, "accounting.view") && await (async () => {
        const { entityFinancials } = await import("@/domain/accounting/intelligence");
        const fin = await entityFinancials(principal, "brand", brand.id);
        const num = (v: unknown) => Number(v).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 3 });
        return (
          <Panel>
            <PanelHeader title="Financial (posted ledger, YTD)" description="Revenue and profit attributed to this brand, per legal company." action={<Link href={`/accounting/intelligence?dim=brand`} className="text-[12px] text-accent hover:underline">Full intelligence →</Link>} />
            {!fin.hasActivity ? <EmptyState title="No ledger activity" description="No posted journal lines carry this brand yet." /> : (
              <DataTable
                columns={[
                  { key: "company", header: "Company", render: (r) => <span className="text-ink">{r.companyName}</span> },
                  { key: "revenue", header: "Revenue", align: "end", render: (r) => <span className="tabular text-ink-2">{num(r.revenue)} {r.baseCurrency}</span> },
                  { key: "gross", header: "Gross profit", align: "end", render: (r) => <span className="tabular text-ink-2">{num(r.grossProfit)}</span> },
                  { key: "net", header: "Net profit", align: "end", render: (r) => { const v = Number(r.netProfit); return <span className={`tabular font-medium ${v < 0 ? "text-critical" : "text-success"}`}>{num(r.netProfit)}</span>; } },
                ] as Column<(typeof fin.rows)[number]>[]}
                rows={fin.rows} getRowKey={(r) => r.companyId}
              />
            )}
          </Panel>
        );
      })()}
    </>
  );
}
