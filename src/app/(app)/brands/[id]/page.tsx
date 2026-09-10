import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { pageGuard } from "@/lib/page-guard";
import { AccessDenied } from "@/components/access-denied";
import { ForbiddenError, canAnywhere } from "@/lib/permissions/engine";
import { getBrand } from "@/domain/brands";
import { getServerI18n } from "@/lib/server-i18n";
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
  const { t } = await getServerI18n();
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
    { key: "overview", label: t("detail.tab.overview") },
    { key: "products", label: t("detail.tab.products"), count: products.length },
    { key: "campaigns", label: t("detail.tab.campaigns"), count: campaigns.length },
    { key: "regulatory", label: t("detail.tab.regulatory"), count: registrations.length },
    { key: "documents", label: t("detail.tab.documents"), count: documents.length },
    { key: "customer-service", label: t("detail.tab.customerService"), count: cases.length },
    ...(canAnywhere(principal, "accounting.view") ? [{ key: "financial", label: t("detail.tab.financial") }] : []),
  ];

  return (
    <>
      {/* 360 header (§44) */}
      <div className="mb-1 text-xs text-ink-3">
        <Link href="/brands" className="hover:text-ink-2">{t("detail.tab.brands")}</Link> <span className="mx-1">/</span> {brand.name}
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
            <PanelHeader title={t("detail.markets")} description={t("detail.brandMarketsSub")} />
            <ul className="grid grid-cols-2 gap-px bg-line sm:grid-cols-3">
              {markets.map((m) => (
                <li key={m.id} className="bg-surface px-4 py-3">
                  <CountryChip name={refName(lookups.countries, m.countryId)} iso2={lookups.countries.get(m.countryId)?.meta} />
                  <div className="mt-1"><Badge category={m.status === "active" ? "success" : "neutral"}>{t(`status.${m.status}`)}</Badge></div>
                </li>
              ))}
              {markets.length === 0 && <li className="bg-surface px-4 py-6 text-sm text-ink-3">{t("detail.noMarketsYet")}</li>}
            </ul>
          </Panel>
          <Panel>
            <PanelHeader title={t("detail.companies")} description={t("detail.brandCompaniesSub")} />
            <ul className="divide-y divide-line">
              {companyLinks.map((cl) => (
                <li key={cl.id} className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-[13px] text-ink">{refName(lookups.companies, cl.companyId)}</span>
                  {cl.isPrimary && <Badge category="info">{t("detail.primary")}</Badge>}
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
              { key: "name", header: t("detail.product"), render: (p) => p.name },
              { key: "sku", header: "SKU", render: (p) => <span className="font-mono text-xs text-ink-3">{p.sku}</span> },
              { key: "category", header: t("common.category"), render: (p) => p.category ?? "—" },
              { key: "status", header: t("common.status"), render: (p) => <StatusBadge module="generic" status={p.status} /> },
              { key: "launch", header: t("detail.launched"), align: "end", render: (p) => formatDate(p.launchDate, locale) },
            ] as Column<(typeof products)[number]>[]}
            rows={products}
            getRowKey={(p) => p.id}
            getRowHref={(p) => `/products/${p.id}`}
            empty={<EmptyState title={t("detail.noProducts")} description={t("detail.noProductsBody")} />}
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
            empty={<EmptyState title={t("detail.noCampaigns")} description={t("detail.noCampaignsBody")} />}
          />
        </Panel>
      )}

      {tab === "regulatory" && (
        <Panel>
          <DataTable
            columns={[
              { key: "product", header: t("detail.product"), render: (r) => refName(lookups.products, r.productId) },
              { key: "country", header: t("common.market"), render: (r) => <CountryChip name={refName(lookups.countries, r.countryId)} iso2={lookups.countries.get(r.countryId)?.meta} /> },
              { key: "number", header: t("detail.regNumber"), render: (r) => <span className="font-mono text-xs">{r.registrationNumber ?? "—"}</span> },
              { key: "status", header: t("common.status"), render: (r) => <StatusBadge module="registration" status={r.status} /> },
              { key: "expiry", header: t("detail.expiry"), align: "end", render: (r) => formatDate(r.expiryDate, locale) },
            ] as Column<(typeof registrations)[number]>[]}
            rows={registrations}
            getRowKey={(r) => r.id}
            getRowHref={(r) => `/registrations/${r.id}`}
            empty={<EmptyState title={t("detail.noRegCases")} description={t("detail.noRegCasesBody")} />}
          />
        </Panel>
      )}

      {tab === "documents" && (
        <Panel>
          <DataTable
            columns={[
              { key: "title", header: t("detail.document"), render: (d) => d.title },
              { key: "country", header: t("common.market"), render: (d) => refName(lookups.countries, d.countryId) },
              { key: "expiry", header: "Expiry", render: (d) => {
                const days = daysUntil(d.expiryDate);
                return <span className={days !== null && days < 30 ? "text-critical" : "text-ink"}>{formatDate(d.expiryDate, locale)}{days !== null && days >= 0 && days < 60 ? ` · ${days}d` : ""}</span>;
              } },
              { key: "status", header: t("common.status"), align: "end", render: (d) => <StatusBadge module="document" status={d.status} /> },
            ] as Column<(typeof documents)[number]>[]}
            rows={documents}
            getRowKey={(d) => d.id}
            empty={<EmptyState title={t("detail.noDocuments")} description={t("detail.noDocumentsBody")} />}
          />
        </Panel>
      )}

      {tab === "customer-service" && (
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
            empty={<EmptyState title={t("detail.noCustomerCases")} description={t("detail.noCustomerCasesBody")} />}
          />
        </Panel>
      )}

      {tab === "financial" && canAnywhere(principal, "accounting.view") && await (async () => {
        const { entityFinancials } = await import("@/domain/accounting/intelligence");
        const fin = await entityFinancials(principal, "brand", brand.id);
        const num = (v: unknown) => Number(v).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 3 });
        return (
          <Panel>
            <PanelHeader title={t("detail.finYtd")} description={t("detail.finSub")} action={<Link href={`/accounting/intelligence?dim=brand`} className="text-[12px] text-accent hover:underline">{t("detail.fullIntelligence")}</Link>} />
            {!fin.hasActivity ? <EmptyState title={t("detail.noLedger")} description={t("detail.noLedgerBody")} /> : (
              <DataTable
                columns={[
                  { key: "company", header: t("detail.company"), render: (r) => <span className="text-ink">{r.companyName}</span> },
                  { key: "revenue", header: t("detail.revenue"), align: "end", render: (r) => <span className="tabular text-ink-2">{num(r.revenue)} {r.baseCurrency}</span> },
                  { key: "gross", header: t("detail.grossProfit"), align: "end", render: (r) => <span className="tabular text-ink-2">{num(r.grossProfit)}</span> },
                  { key: "net", header: t("detail.netProfit"), align: "end", render: (r) => { const v = Number(r.netProfit); return <span className={`tabular font-medium ${v < 0 ? "text-critical" : "text-success"}`}>{num(r.netProfit)}</span>; } },
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
