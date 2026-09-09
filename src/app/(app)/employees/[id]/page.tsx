import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { pageGuard } from "@/lib/page-guard";
import { AccessDenied } from "@/components/access-denied";
import { ForbiddenError } from "@/lib/permissions/engine";
import { getEmployee } from "@/domain/employees";
import { getLookups, refName } from "@/domain/lookups";
import { Panel, PanelHeader, PanelBody, StatusBadge, Metric, Avatar } from "@/components/ui";
import { BrandChip, CountryChip } from "@/components/entity-chips";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Employee" };

export default async function EmployeeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { principal, locale } = await pageGuard("employees.view");
  const { id } = await params;

  let data;
  try {
    data = await getEmployee(principal, id);
  } catch (err) {
    if (err instanceof ForbiddenError) return <AccessDenied locale={locale} />;
    throw err;
  }
  if (!data) notFound();

  const { employee, openTasks, departmentName } = data;
  const lookups = await getLookups();

  const brands = employee.brandAssignments;
  const countries = employee.countryAssignments;

  return (
    <>
      {/* 360 header (§44) */}
      <div className="mb-1 text-xs text-ink-3">
        <Link href="/employees" className="hover:text-ink-2">Employees</Link> <span className="mx-1">/</span> {employee.user.name}
      </div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Avatar name={employee.user.name} color={employee.user.avatarColor} size={44} className="text-lg" />
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-ink">{employee.user.name}</h1>
            <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-ink-3">
              <span>{employee.position ?? "No position set"}</span>
              <StatusBadge module="generic" status={employee.employmentStatus} />
              <span>· {refName(lookups.companies, employee.companyId)} · {openTasks} open tasks</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel className="lg:col-span-1">
          <PanelHeader title="Profile" description="Employment record" />
          <PanelBody className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-ink-3">Company</div>
              <div className="mt-0.5 text-[13px] text-ink">{refName(lookups.companies, employee.companyId)}</div>
            </div>
            <div>
              <div className="text-xs text-ink-3">Department</div>
              <div className="mt-0.5 text-[13px] text-ink">{departmentName ?? "—"}</div>
            </div>
            <div>
              <div className="text-xs text-ink-3">Join date</div>
              <div className="mt-0.5 text-[13px] text-ink tabular">{formatDate(employee.joinDate, locale)}</div>
            </div>
            <div>
              <div className="text-xs text-ink-3">Status</div>
              <div className="mt-0.5"><StatusBadge module="generic" status={employee.employmentStatus} /></div>
            </div>
            <div className="col-span-2 border-t border-line pt-4">
              <Metric label="Open tasks" value={openTasks} category={openTasks > 0 ? "info" : "neutral"} sub="Assigned to this person and not yet completed" />
            </div>
          </PanelBody>
        </Panel>

        <Panel className="lg:col-span-1">
          <PanelHeader title="Assigned brands" description="Brands this person works across" />
          {brands.length > 0 ? (
            <ul className="divide-y divide-line">
              {brands.map((b) => (
                <li key={b.id} className="px-4 py-2.5">
                  <BrandChip name={refName(lookups.brands, b.brandId)} color={lookups.brands.get(b.brandId)?.meta} />
                </li>
              ))}
            </ul>
          ) : (
            <PanelBody>
              <p className="text-[13px] text-ink-3">No brand assignments. This person is not scoped to any specific brand — assign brands to route brand work to them.</p>
            </PanelBody>
          )}
        </Panel>

        <Panel className="lg:col-span-1">
          <PanelHeader title="Assigned markets" description="Countries this person covers" />
          {countries.length > 0 ? (
            <ul className="divide-y divide-line">
              {countries.map((c) => (
                <li key={c.id} className="px-4 py-2.5">
                  <CountryChip name={refName(lookups.countries, c.countryId)} iso2={lookups.countries.get(c.countryId)?.meta} />
                </li>
              ))}
            </ul>
          ) : (
            <PanelBody>
              <p className="text-[13px] text-ink-3">No market assignments. Assign countries so market-specific work reaches this person.</p>
            </PanelBody>
          )}
        </Panel>
      </div>
    </>
  );
}
