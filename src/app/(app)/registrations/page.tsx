import type { Metadata } from "next";
import { ClipboardCheck } from "lucide-react";
import type { RegistrationCase } from "@prisma/client";
import { pageGuard } from "@/lib/page-guard";
import { AccessDenied } from "@/components/access-denied";
import { listRegistrations, getAuthorityNames, registrationQuerySchema } from "@/domain/registrations";
import { getLookups, refName } from "@/domain/lookups";
import { PageHeader, Panel, DataTable, StatusBadge, Badge, type Column } from "@/components/ui";
import { ListToolbar } from "@/components/list/toolbar";
import { Pagination } from "@/components/list/pagination";
import { BrandChip, CountryChip } from "@/components/entity-chips";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Registrations" };

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

  const sp = await searchParams;
  const query = registrationQuerySchema.parse(sp);
  const { rows, total } = await listRegistrations(principal, query);
  const [lookups, authorities] = await Promise.all([getLookups(), getAuthorityNames()]);

  const brandOptions = [...lookups.brands.values()]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((b) => ({ value: b.id, label: b.name }));
  const countryOptions = [...lookups.countries.values()]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((c) => ({ value: c.id, label: c.name }));

  const blocked = query.filter === "blocked";

  const columns: Column<RegistrationCase>[] = [
    { key: "product", header: "Product", render: (r) => refName(lookups.products, r.productId) },
    { key: "brand", header: "Brand", render: (r) => <BrandChip name={refName(lookups.brands, r.brandId)} color={lookups.brands.get(r.brandId ?? "")?.meta} /> },
    { key: "country", header: "Market", render: (r) => <CountryChip name={refName(lookups.countries, r.countryId)} iso2={lookups.countries.get(r.countryId)?.meta} /> },
    { key: "authority", header: "Authority", render: (r) => <span className="text-ink-2">{(r.authorityId && authorities.get(r.authorityId)) || "—"}</span> },
    { key: "number", header: "Reg. number", render: (r) => <span className="font-mono text-xs text-ink-3">{r.registrationNumber ?? "—"}</span> },
    { key: "status", header: "Status", render: (r) => <StatusBadge module="registration" status={r.status} /> },
    { key: "expiry", header: "Expiry", align: "end", render: (r) => formatDate(r.expiryDate, locale) },
  ];

  return (
    <>
      <PageHeader
        title="Registrations"
        description="Every product registration across authorities and markets — one workflow from preparation to renewal, with expiry and blocked-stage visibility (§14)."
        meta={
          <div className="flex items-center gap-2">
            <Badge category="neutral">{total} cases</Badge>
            {blocked && <Badge category="warning">Blocked stages only</Badge>}
          </div>
        }
      />
      <ListToolbar
        placeholder="Search by registration number…"
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
