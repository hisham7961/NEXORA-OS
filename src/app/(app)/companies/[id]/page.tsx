import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { pageGuard } from "@/lib/page-guard";
import { AccessDenied } from "@/components/access-denied";
import { ForbiddenError } from "@/lib/permissions/engine";
import { getCompany } from "@/domain/companies";
import { getLookups, refName } from "@/domain/lookups";
import { Panel, PanelHeader, PanelBody, DataTable, StatusBadge, Badge, TabBar, EmptyState, Metric, type Column, type TabItem } from "@/components/ui";
import { BrandChip, CountryChip, UserChip } from "@/components/entity-chips";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Company" };

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default async function CompanyDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string>>;
}) {
  const { principal, locale } = await pageGuard("companies.view");
  const { id } = await params;
  const tab = (await searchParams).tab ?? "overview";

  let data;
  try {
    data = await getCompany(principal, id);
  } catch (err) {
    if (err instanceof ForbiddenError) return <AccessDenied locale={locale} />;
    throw err;
  }
  if (!data) notFound();

  const { company, brandLinks, employees, accounts, accountCount, fiscalYears } = data;
  const lookups = await getLookups();

  const openYears = fiscalYears.filter((f) => f.status === "open").length;

  const tabs: TabItem[] = [
    { key: "overview", label: "Overview" },
    { key: "brands", label: "Brands", count: brandLinks.length },
    { key: "employees", label: "Employees", count: employees.length },
    { key: "finance", label: "Finance", count: accountCount },
  ];

  return (
    <>
      {/* 360 header (§44) */}
      <div className="mb-1 text-xs text-ink-3">
        <Link href="/companies" className="hover:text-ink-2">Companies</Link> <span className="mx-1">/</span> {company.name}
      </div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl text-lg font-bold text-white shadow-sm" style={{ background: company.logoColor ?? "var(--accent)" }}>
            {company.name[0]}
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-ink">{company.name}</h1>
            <div className="mt-0.5 flex items-center gap-2 text-xs text-ink-3">
              <span className="font-mono">{company.code}</span>
              <StatusBadge module="generic" status={company.status} />
              <span>· {company.baseCurrency} · {brandLinks.length} brands · {employees.length} employees</span>
            </div>
          </div>
        </div>
      </div>

      <TabBar tabs={tabs} current={tab} className="mb-4" />

      {tab === "overview" && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Panel className="lg:col-span-2">
            <PanelHeader title="Profile" description="Legal identity and operating defaults" />
            <dl className="grid grid-cols-1 gap-px bg-line sm:grid-cols-2">
              <Field label="Legal name" value={company.legalName ?? company.name} />
              <Field label="Code" value={<span className="font-mono">{company.code}</span>} />
              <Field label="Base currency" value={<span className="font-mono">{company.baseCurrency}</span>} />
              <Field label="Timezone" value={company.timezone} />
              <Field label="Fiscal year starts" value={MONTHS[(company.fiscalYearStartMonth - 1 + 12) % 12] ?? "—"} />
              <Field label="Headquarters" value={<CountryChip name={refName(lookups.countries, company.hqCountryId)} iso2={lookups.countries.get(company.hqCountryId ?? "")?.meta} />} />
              <Field label="Status" value={<StatusBadge module="generic" status={company.status} />} />
              <Field label="Created" value={formatDate(company.createdAt, locale)} />
            </dl>
          </Panel>
          <Panel>
            <PanelHeader title="At a glance" description="Scale of this entity" />
            <PanelBody>
              <div className="grid grid-cols-2 gap-4">
                <Metric label="Brands" value={brandLinks.length} />
                <Metric label="Employees" value={employees.length} />
                <Metric label="GL accounts" value={accountCount} />
                <Metric label="Fiscal years" value={fiscalYears.length} sub={`${openYears} open`} category={openYears > 0 ? "success" : "neutral"} />
              </div>
            </PanelBody>
          </Panel>
        </div>
      )}

      {tab === "brands" && (
        <Panel>
          <DataTable
            columns={[
              { key: "brand", header: "Brand", render: (cl) => <BrandChip name={refName(lookups.brands, cl.brandId)} color={lookups.brands.get(cl.brandId)?.meta} /> },
              { key: "primary", header: "Relationship", align: "end", render: (cl) => (cl.isPrimary ? <Badge category="info">Primary</Badge> : <span className="text-ink-3">Associated</span>) },
            ] as Column<(typeof brandLinks)[number]>[]}
            rows={brandLinks}
            getRowKey={(cl) => cl.id}
            getRowHref={(cl) => `/brands/${cl.brandId}`}
            empty={<EmptyState title="No brands linked" description="Brands operated under this legal entity will appear here. Link a brand to a company from the brand's Companies tab." />}
          />
        </Panel>
      )}

      {tab === "employees" && (
        <Panel>
          <DataTable
            columns={[
              { key: "name", header: "Employee", render: (e) => <UserChip name={refName(lookups.users, e.userId)} color={lookups.users.get(e.userId)?.meta} /> },
              { key: "position", header: "Position", render: (e) => e.position ?? "—" },
              { key: "joined", header: "Joined", render: (e) => formatDate(e.joinDate, locale) },
              { key: "status", header: "Status", align: "end", render: (e) => <StatusBadge module="generic" status={e.employmentStatus} /> },
            ] as Column<(typeof employees)[number]>[]}
            rows={employees}
            getRowKey={(e) => e.id}
            empty={<EmptyState title="No employees" description="People assigned to this company will appear here. Employees are managed from the Employees module." />}
          />
        </Panel>
      )}

      {tab === "finance" && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Panel className="lg:col-span-2">
            <PanelHeader title="Chart of accounts" description={`${accountCount} accounts across this entity's ledger`} />
            <DataTable
              columns={[
                { key: "code", header: "Code", render: (a) => <span className="font-mono text-xs text-ink-3">{a.code}</span> },
                { key: "name", header: "Account", render: (a) => a.name },
                { key: "type", header: "Type", render: (a) => <span className="capitalize">{a.type}</span> },
                { key: "active", header: "State", align: "end", render: (a) => <Badge category={a.isActive ? "success" : "neutral"}>{a.isActive ? "Active" : "Inactive"}</Badge> },
              ] as Column<(typeof accounts)[number]>[]}
              rows={accounts}
              getRowKey={(a) => a.id}
              empty={<EmptyState title="No accounts yet" description="This company has no chart of accounts. Accounting must be set up before journals can be posted." />}
            />
          </Panel>
          <Panel>
            <PanelHeader title="Fiscal years" description="Reporting periods for this entity" />
            <ul className="divide-y divide-line">
              {fiscalYears.map((fy) => (
                <li key={fy.id} className="flex items-center justify-between px-4 py-2.5">
                  <div className="min-w-0">
                    <div className="text-[13px] text-ink">{fy.name}</div>
                    <div className="text-xs text-ink-3 tabular">{formatDate(fy.startDate, locale)} – {formatDate(fy.endDate, locale)}</div>
                  </div>
                  <Badge category={fy.status === "open" ? "success" : "neutral"}>{fy.status}</Badge>
                </li>
              ))}
              {fiscalYears.length === 0 && (
                <li className="px-4 py-6 text-sm text-ink-3">No fiscal years defined. Add one to open accounting periods for this company.</li>
              )}
            </ul>
          </Panel>
        </div>
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
