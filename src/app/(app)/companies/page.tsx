import type { Metadata } from "next";
import { Building2 } from "lucide-react";
import { pageGuard } from "@/lib/page-guard";
import { AccessDenied } from "@/components/access-denied";
import { canAnywhere } from "@/lib/permissions/engine";
import { listCompanies, companyQuerySchema, type CompanyRow } from "@/domain/companies";
import { getLookups } from "@/domain/lookups";
import { PageHeader, Panel, DataTable, StatusBadge, Badge, type Column } from "@/components/ui";
import { ListToolbar } from "@/components/list/toolbar";
import { Pagination } from "@/components/list/pagination";
import { CompanyForm } from "@/components/org/org-forms";

export const metadata: Metadata = { title: "Companies" };

export default async function CompaniesPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const { principal, locale, denied } = await pageGuard("companies.view");
  if (denied) return <AccessDenied locale={locale} />;

  const sp = await searchParams;
  const query = companyQuerySchema.parse(sp);
  const { rows, total } = await listCompanies(principal, query);
  const canCreate = canAnywhere(principal, "companies.create");
  const lookups = await getLookups();
  const countryOptions = [...lookups.countries.values()].sort((a, b) => a.name.localeCompare(b.name)).map((c) => ({ id: c.id, label: c.name }));

  const columns: Column<CompanyRow>[] = [
    {
      key: "name",
      header: "Company",
      render: (c) => (
        <span className="inline-flex items-center gap-2 text-[13px] text-ink">
          <span
            className="flex h-6 w-6 items-center justify-center rounded-md text-[11px] font-bold text-white"
            style={{ background: c.logoColor ?? "var(--accent)" }}
          >
            {c.name[0]}
          </span>
          {c.name}
        </span>
      ),
    },
    { key: "code", header: "Code", render: (c) => <span className="font-mono text-xs text-ink-3">{c.code}</span> },
    { key: "currency", header: "Base currency", render: (c) => <span className="font-mono text-xs">{c.baseCurrency}</span> },
    { key: "brands", header: "Brands", align: "center", render: (c) => <span className="tabular">{c.brandCount}</span> },
    { key: "employees", header: "Employees", align: "center", render: (c) => <span className="tabular">{c.employeeCount}</span> },
    { key: "status", header: "Status", render: (c) => <StatusBadge module="generic" status={c.status} /> },
  ];

  return (
    <>
      <PageHeader
        title="Companies"
        description="Each legal entity anchors its brands, employees and books — the roots of the group hierarchy."
        meta={<Badge category="neutral">{total} companies</Badge>}
        actions={canCreate ? <CompanyForm mode="create" countries={countryOptions} /> : undefined}
      />
      <ListToolbar
        placeholder="Search companies…"
        filters={[{ name: "status", label: "Status", options: [{ value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }] }]}
      />
      <Panel>
        <DataTable
          columns={columns}
          rows={rows}
          getRowKey={(c) => c.id}
          getRowHref={(c) => `/companies/${c.id}`}
          empty={
            <div className="text-center">
              <Building2 className="mx-auto mb-2 h-6 w-6 text-ink-3" />
              <p className="text-[13px] font-medium text-ink">No companies in your scope</p>
              <p className="mt-1 text-xs text-ink-3">Legal entities you are assigned to will appear here once created in Organization settings.</p>
            </div>
          }
        />
        {total > query.pageSize && <Pagination page={query.page} pageSize={query.pageSize} total={total} params={sp} />}
      </Panel>
    </>
  );
}
