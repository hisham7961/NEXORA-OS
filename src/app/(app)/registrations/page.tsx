import type { Metadata } from "next";
import { ClipboardCheck } from "lucide-react";
import type { RegistrationCase } from "@prisma/client";
import { pageGuard } from "@/lib/page-guard";
import { AccessDenied } from "@/components/access-denied";
import { canAnywhere } from "@/lib/permissions/engine";
import { listRegistrations, getAuthorityNames, registrationQuerySchema } from "@/domain/registrations";
import { getScopedOptions } from "@/domain/options";
import { getLookups, refName } from "@/domain/lookups";
import { NewRegistrationButton } from "@/components/registrations/new-registration-button";
import { PageHeader, Panel, DataTable, StatusBadge, Badge, type Column } from "@/components/ui";
import { ListToolbar } from "@/components/list/toolbar";
import { Pagination } from "@/components/list/pagination";
import { BrandChip, CountryChip } from "@/components/entity-chips";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Registrations" };
import { getServerI18n } from "@/lib/server-i18n";

const STATUS_OPTIONS = [
  { value: "preparation", label: "Preparation" },
  { value: "documents_missing", label: "Documents missing" },
  { value: "ready_submission", label: "Ready to submit" },
  { value: "submitted", label: "Submitted" },
  { value: "authority_review", label: "Authority review" },
  { value: "additional_requirements", label: "Additional requirements" },
  { value: "samples_requested", label: "Samples requested" },
  { value: "payment_required", label: "Payment required" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "registered", label: "Registered" },
  { value: "renewal_required", label: "Renewal required" },
  { value: "expired", label: "Expired" },
];

export default async function RegistrationsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const { principal, locale, denied } = await pageGuard("registrations.view");
  if (denied) return <AccessDenied locale={locale} />;
  const { t } = await getServerI18n();

  const sp = await searchParams;
  const query = registrationQuerySchema.parse(sp);
  const { rows, total } = await listRegistrations(principal, query);
  const canCreate = canAnywhere(principal, "registrations.create");
  const [lookups, authorities, options] = await Promise.all([
    getLookups(),
    getAuthorityNames(),
    canCreate ? getScopedOptions(principal, "registrations.create") : Promise.resolve(null),
  ]);
  const authorityOptions = [...authorities.entries()].map(([id, name]) => ({ id, label: name }));

  const brandOptions = [...lookups.brands.values()]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((b) => ({ value: b.id, label: b.name }));
  const countryOptions = [...lookups.countries.values()]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((c) => ({ value: c.id, label: c.name }));

  const blocked = query.filter === "blocked";

  const columns: Column<RegistrationCase>[] = [
    { key: "product", header: t("products.col.product"), render: (r) => refName(lookups.products, r.productId) },
    { key: "brand", header: t("common.brand"), render: (r) => <BrandChip name={refName(lookups.brands, r.brandId)} color={lookups.brands.get(r.brandId ?? "")?.meta} /> },
    { key: "country", header: t("common.market"), render: (r) => <CountryChip name={refName(lookups.countries, r.countryId)} iso2={lookups.countries.get(r.countryId)?.meta} /> },
    { key: "authority", header: t("reg.col.authority"), render: (r) => <span className="text-ink-2">{(r.authorityId && authorities.get(r.authorityId)) || "—"}</span> },
    { key: "number", header: t("reg.col.regNumber"), render: (r) => <span className="font-mono text-xs text-ink-3">{r.registrationNumber ?? "—"}</span> },
    { key: "status", header: t("common.status"), render: (r) => <StatusBadge module="registration" status={r.status} /> },
    { key: "expiry", header: t("documents.col.expiry"), align: "end", render: (r) => formatDate(r.expiryDate, locale) },
  ];

  return (
    <>
      <PageHeader
        title={t("reg.title")}
        description={t("reg.subtitle")}
        meta={
          <div className="flex items-center gap-2">
            <Badge category="neutral">{total} cases</Badge>
            {blocked && <Badge category="warning">Blocked stages only</Badge>}
          </div>
        }
        actions={canCreate && options ? <NewRegistrationButton countries={options.countries} brands={options.brands} users={options.users} authorities={authorityOptions} /> : undefined}
      />
      <ListToolbar
        placeholder={t("reg.searchPlaceholder")}
        filters={[
          { name: "status", label: "Status", options: STATUS_OPTIONS },
          { name: "brandId", label: "Brand", options: brandOptions },
          { name: "countryId", label: "Market", options: countryOptions },
          { name: "filter", label: "View", options: [{ value: "blocked", label: "Blocked / needs action" }] },
        ]}
      />
      <Panel>
        <DataTable
          columns={columns}
          rows={rows}
          getRowKey={(r) => r.id}
          getRowHref={(r) => `/registrations/${r.id}`}
          empty={
            <div className="text-center">
              <ClipboardCheck className="mx-auto mb-2 h-6 w-6 text-ink-3" />
              <p className="text-[13px] font-medium text-ink">
                {blocked ? "Nothing is blocked in your scope" : "No registration cases in your scope"}
              </p>
              <p className="mt-1 text-xs text-ink-3">
                {blocked
                  ? "No cases are waiting on documents, requirements, payment, samples or a rejection. Clear the view filter to see all cases."
                  : "Registration cases connect a product to a regulatory authority in a market. Those for brands and markets you can access will appear here — adjust your filters or open a product to start one."}
              </p>
            </div>
          }
        />
        {total > query.pageSize && <Pagination page={query.page} pageSize={query.pageSize} total={total} params={sp} />}
      </Panel>
    </>
  );
}
