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
import { getServerI18n } from "@/lib/server-i18n";

export const metadata: Metadata = { title: "Employee" };

export default async function EmployeeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { principal, locale } = await pageGuard("employees.view");
  const { t } = await getServerI18n();
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
        <Link href="/employees" className="hover:text-ink-2">{t("dp.employeesNav")}</Link> <span className="mx-1">/</span> {employee.user.name}
      </div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Avatar name={employee.user.name} color={employee.user.avatarColor} size={44} className="text-lg" />
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-ink">{employee.user.name}</h1>
            <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-ink-3">
              <span>{employee.position ?? t("emp.noPositionSet")}</span>
              <StatusBadge module="generic" status={employee.employmentStatus} />
              <span>· {refName(lookups.companies, employee.companyId)} · {openTasks} open tasks</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel className="lg:col-span-1">
          <PanelHeader title={t("detail.profile")} description={t("emp.employmentRecord")} />
          <PanelBody className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-ink-3">{t("common.company")}</div>
              <div className="mt-0.5 text-[13px] text-ink">{refName(lookups.companies, employee.companyId)}</div>
            </div>
            <div>
              <div className="text-xs text-ink-3">{t("emp.department")}</div>
              <div className="mt-0.5 text-[13px] text-ink">{departmentName ?? "—"}</div>
            </div>
            <div>
              <div className="text-xs text-ink-3">{t("emp.joinDate")}</div>
              <div className="mt-0.5 text-[13px] text-ink tabular">{formatDate(employee.joinDate, locale)}</div>
            </div>
            <div>
              <div className="text-xs text-ink-3">{t("common.status")}</div>
              <div className="mt-0.5"><StatusBadge module="generic" status={employee.employmentStatus} /></div>
            </div>
            <div className="col-span-2 border-t border-line pt-4">
              <Metric label={t("emp.openTasks")} value={openTasks} category={openTasks > 0 ? "info" : "neutral"} />
            </div>
          </PanelBody>
        </Panel>

        <Panel className="lg:col-span-1">
          <PanelHeader title={t("emp.assignedBrands")} description={t("emp.assignedBrandsSub")} />
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
              <p className="text-[13px] text-ink-3">{t("emp.noBrandAssignments")}</p>
            </PanelBody>
          )}
        </Panel>

        <Panel className="lg:col-span-1">
          <PanelHeader title={t("emp.assignedMarkets")} description={t("emp.assignedMarketsSub")} />
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
              <p className="text-[13px] text-ink-3">{t("emp.noMarketAssignments")}</p>
            </PanelBody>
          )}
        </Panel>
      </div>
    </>
  );
}
