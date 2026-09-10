import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { pageGuard } from "@/lib/page-guard";
import { AccessDenied } from "@/components/access-denied";
import { ForbiddenError, canAnywhere } from "@/lib/permissions/engine";
import { getCompany } from "@/domain/companies";
import { getServerI18n } from "@/lib/server-i18n";
import { getLookups, refName } from "@/domain/lookups";
import { Panel, PanelHeader, PanelBody, DataTable, StatusBadge, Badge, TabBar, EmptyState, Metric, type Column, type TabItem } from "@/components/ui";
import { BrandChip, CountryChip, UserChip } from "@/components/entity-chips";
import { CompanyForm, ArchiveOrgButton } from "@/components/org/org-forms";
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
  const { t } = await getServerI18n();
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
    { key: "overview", label: t("detail.tab.overview") },
    { key: "brands", label: t("detail.brands"), count: brandLinks.length },
    { key: "employees", label: t("detail.tab.employees"), count: employees.length },
    { key: "finance", label: t("detail.tab.finance"), count: accountCount },
  ];

  return (
    <>
      {/* 360 header (§44) */}
      <div className="mb-1 text-xs text-ink-3">
        <Link href="/companies" className="hover:text-ink-2">{t("detail.companies")}</Link> <span className="mx-1">/</span> {company.name}
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
        {canAnywhere(principal, "companies.edit") && (
          <div className="flex items-center gap-2">
            <CompanyForm mode="edit" countries={[...lookups.countries.values()].sort((a, b) => a.name.localeCompare(b.name)).map((c) => ({ id: c.id, label: c.name }))} defaults={{ id: company.id, name: company.name, legalName: company.legalName, code: company.code, baseCurrency: company.baseCurrency, hqCountryId: company.hqCountryId, timezone: company.timezone, fiscalYearStartMonth: company.fiscalYearStartMonth, status: company.status }} />
            {canAnywhere(principal, "companies.delete") && <ArchiveOrgButton kind="company" id={company.id} redirect="/companies" />}
          </div>
        )}
      </div>

      <TabBar tabs={tabs} current={tab} className="mb-4" />

      {tab === "overview" && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Panel className="lg:col-span-2">
            <PanelHeader title={t("detail.profile")} description={t("detail.profileSub")} />
            <dl className="grid grid-cols-1 gap-px bg-line sm:grid-cols-2">
              <Field label={t("detail.legalName")} value={company.legalName ?? company.name} />
              <Field label={t("detail.code")} value={<span className="font-mono">{company.code}</span>} />
              <Field label={t("acct.baseCurrency")} value={<span className="font-mono">{company.baseCurrency}</span>} />
              <Field label={t("common.timezone")} value={company.timezone} />
              <Field label={t("detail.fiscalYearStarts")} value={t(`detail.month.${((company.fiscalYearStartMonth - 1 + 12) % 12) + 1}`)} />
              <Field label={t("detail.headquarters")} value={<CountryChip name={refName(lookups.countries, company.hqCountryId)} iso2={lookups.countries.get(company.hqCountryId ?? "")?.meta} />} />
              <Field label={t("common.status")} value={<StatusBadge module="generic" status={company.status} />} />
              <Field label={t("common.created")} value={formatDate(company.createdAt, locale)} />
            </dl>
          </Panel>
          <Panel>
            <PanelHeader title={t("detail.atAGlance")} description={t("detail.atAGlanceSub")} />
            <PanelBody>
              <div className="grid grid-cols-2 gap-4">
                <Metric label={t("detail.brands")} value={brandLinks.length} />
                <Metric label={t("detail.employees")} value={employees.length} />
                <Metric label={t("detail.glAccounts")} value={accountCount} />
                <Metric label={t("detail.fiscalYears")} value={fiscalYears.length} sub={t("detail.openCount", { count: openYears })} category={openYears > 0 ? "success" : "neutral"} />
              </div>
            </PanelBody>
          </Panel>
        </div>
      )}

      {tab === "brands" && (
        <Panel>
          <DataTable
            columns={[
              { key: "brand", header: t("detail.brand"), render: (cl) => <BrandChip name={refName(lookups.brands, cl.brandId)} color={lookups.brands.get(cl.brandId)?.meta} /> },
              { key: "primary", header: t("detail.relationship"), align: "end", render: (cl) => (cl.isPrimary ? <Badge category="info">{t("detail.primary")}</Badge> : <span className="text-ink-3">{t("detail.associated")}</span>) },
            ] as Column<(typeof brandLinks)[number]>[]}
            rows={brandLinks}
            getRowKey={(cl) => cl.id}
            getRowHref={(cl) => `/brands/${cl.brandId}`}
            empty={<EmptyState title={t("detail.noBrandsLinked")} description={t("detail.noBrandsLinkedBody")} />}
          />
        </Panel>
      )}

      {tab === "employees" && (
        <Panel>
          <DataTable
            columns={[
              { key: "name", header: t("detail.employee"), render: (e) => <UserChip name={refName(lookups.users, e.userId)} color={lookups.users.get(e.userId)?.meta} /> },
              { key: "position", header: t("detail.position"), render: (e) => e.position ?? "—" },
              { key: "joined", header: t("detail.joined"), render: (e) => formatDate(e.joinDate, locale) },
              { key: "status", header: t("common.status"), align: "end", render: (e) => <StatusBadge module="generic" status={e.employmentStatus} /> },
            ] as Column<(typeof employees)[number]>[]}
            rows={employees}
            getRowKey={(e) => e.id}
            empty={<EmptyState title={t("detail.noEmployees")} description={t("detail.noEmployeesBody")} />}
          />
        </Panel>
      )}

      {tab === "finance" && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Panel className="lg:col-span-2">
            <PanelHeader title={t("detail.chartOfAccounts")} description={t("detail.chartOfAccountsSub", { count: accountCount })} />
            <DataTable
              columns={[
                { key: "code", header: t("detail.code"), render: (a) => <span className="font-mono text-xs text-ink-3">{a.code}</span> },
                { key: "name", header: t("detail.account"), render: (a) => a.name },
                { key: "type", header: t("common.type"), render: (a) => <span className="capitalize">{t(`fin.acctType.${a.type}`)}</span> },
                { key: "active", header: t("detail.state"), align: "end", render: (a) => <Badge category={a.isActive ? "success" : "neutral"}>{a.isActive ? t("detail.activeCap") : t("detail.inactiveCap")}</Badge> },
              ] as Column<(typeof accounts)[number]>[]}
              rows={accounts}
              getRowKey={(a) => a.id}
              empty={<EmptyState title={t("detail.noAccountsYet")} description={t("detail.noAccountsYetBody")} />}
            />
          </Panel>
          <Panel>
            <PanelHeader title={t("detail.fiscalYearsPanel")} description={t("detail.fiscalYearsSub")} />
            <ul className="divide-y divide-line">
              {fiscalYears.map((fy) => (
                <li key={fy.id} className="flex items-center justify-between px-4 py-2.5">
                  <div className="min-w-0">
                    <div className="text-[13px] text-ink">{fy.name}</div>
                    <div className="text-xs text-ink-3 tabular">{formatDate(fy.startDate, locale)} – {formatDate(fy.endDate, locale)}</div>
                  </div>
                  <Badge category={fy.status === "open" ? "success" : "neutral"}>{t(`status.${fy.status}`)}</Badge>
                </li>
              ))}
              {fiscalYears.length === 0 && (
                <li className="px-4 py-6 text-sm text-ink-3">{t("detail.noFiscalYears")}</li>
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
