import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { pageGuard } from "@/lib/page-guard";
import { AccessDenied } from "@/components/access-denied";
import { canAnywhere, ForbiddenError } from "@/lib/permissions/engine";
import { getRegistration, getAuthorityNames } from "@/domain/registrations";
import { RegistrationActions } from "@/components/registrations/registration-actions";
import { EntityFiles } from "@/components/files/entity-files";
import { WorkflowPanel } from "@/components/workflows/workflow-panel";
import { getLookups, refName } from "@/domain/lookups";
import { Panel, PanelHeader, PanelBody, StatusBadge, Badge } from "@/components/ui";
import { BrandChip, CountryChip, UserChip } from "@/components/entity-chips";
import { formatDate, formatDateTime } from "@/lib/format";
import { getServerI18n } from "@/lib/server-i18n";

export const metadata: Metadata = { title: "Registration Case" };

export default async function RegistrationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { principal, locale } = await pageGuard("registrations.view");
  const { t } = await getServerI18n();
  const { id } = await params;
  let data;
  try {
    data = await getRegistration(principal, id);
  } catch (e) {
    if (e instanceof ForbiddenError) return <AccessDenied locale={locale} />;
    throw e;
  }
  if (!data) notFound();
  const { registration: r, events, docReqs } = data;
  const [lookups, authorities] = await Promise.all([getLookups(), getAuthorityNames()]);
  const canEdit = canAnywhere(principal, "registrations.edit");

  return (
    <>
      <div className="mb-1 text-xs text-ink-3"><Link href="/registrations" className="hover:text-ink-2">{t("dp.registrationsNav")}</Link> / {r.registrationNumber ?? t("reg.newCase")}</div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-ink">{refName(lookups.products, r.productId)}</h1>
          <div className="mt-0.5 text-xs text-ink-3">{r.registrationNumber ? <span className="font-mono">{r.registrationNumber}</span> : t("reg.noRegNumber")}</div>
        </div>
        <StatusBadge module="registration" status={r.status} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel className="lg:col-span-2">
          <PanelHeader title={t("reg.timeline")} description={t("reg.timelineSub")} />
          <PanelBody>
            {events.length === 0 ? <p className="text-[13px] text-ink-3">{t("reg.noEvents")}</p> : (
              <ol className="relative ms-2 space-y-4 border-s border-line ps-4">
                {events.map((e) => (
                  <li key={e.id} className="relative">
                    <span className="absolute -start-[21px] top-1 h-2.5 w-2.5 rounded-full bg-accent" />
                    <div className="text-[13px] font-medium text-ink">{e.title}</div>
                    {e.description && <div className="text-xs text-ink-2">{e.description}</div>}
                    <div className="text-[11px] text-ink-3">{formatDateTime(e.createdAt, locale)}{e.actorId ? ` · ${refName(lookups.users, e.actorId)}` : ""}</div>
                  </li>
                ))}
              </ol>
            )}
          </PanelBody>
        </Panel>

        <div className="space-y-4">
          <Panel>
            <PanelHeader title={t("dp.case")} />
            <PanelBody>
              <dl className="space-y-2.5 text-[13px]">
                <div className="flex justify-between"><dt className="text-ink-3">{t("common.brand")}</dt><dd><BrandChip name={refName(lookups.brands, r.brandId)} color={r.brandId ? lookups.brands.get(r.brandId)?.meta : null} /></dd></div>
                <div className="flex justify-between"><dt className="text-ink-3">{t("common.market")}</dt><dd><CountryChip name={refName(lookups.countries, r.countryId)} iso2={lookups.countries.get(r.countryId)?.meta} /></dd></div>
                <div className="flex justify-between"><dt className="text-ink-3">{t("reg.authority")}</dt><dd className="text-ink">{r.authorityId ? authorities.get(r.authorityId) ?? "—" : "—"}</dd></div>
                <div className="flex justify-between"><dt className="text-ink-3">{t("dp.assigned")}</dt><dd><UserChip name={refName(lookups.users, r.assignedToId)} color={r.assignedToId ? lookups.users.get(r.assignedToId)?.meta : null} /></dd></div>
                <div className="flex justify-between"><dt className="text-ink-3">{t("reg.submitted")}</dt><dd className="text-ink">{formatDate(r.submissionDate, locale)}</dd></div>
                <div className="flex justify-between"><dt className="text-ink-3">{t("detail.expiry")}</dt><dd className="text-ink">{formatDate(r.expiryDate, locale)}</dd></div>
              </dl>
            </PanelBody>
          </Panel>
          <Panel>
            <PanelHeader title={canEdit ? t("dp.actions") : t("reg.docsCerts")} description={canEdit ? t("reg.timelineSub") : undefined} />
            <PanelBody>
              {canEdit ? (
                <RegistrationActions caseId={r.id} status={r.status} requirements={docReqs.map((d) => ({ id: d.id, name: d.name, status: d.status }))} />
              ) : docReqs.length === 0 ? (
                <p className="text-[13px] text-ink-3">{t("reg.noDocs")}</p>
              ) : (
                <ul className="space-y-1.5">
                  {docReqs.map((d) => (
                    <li key={d.id} className="flex items-center justify-between text-[13px]">
                      <span className="text-ink">{d.name}</span>
                      <Badge category={d.status === "submitted" || d.status === "received" ? "success" : d.status === "missing" ? "critical" : "warning"}>{t(`status.${d.status}`)}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </PanelBody>
          </Panel>
          <WorkflowPanel
            principal={principal}
            entityType="RegistrationCase"
            entityId={r.id}
            module="registrations"
            scope={{ companyId: r.companyId, brandId: r.brandId, countryId: r.countryId }}
            locale={locale}
          />
          <EntityFiles
            principal={principal}
            entityType="RegistrationCase"
            entityId={r.id}
            scope={{ companyId: r.companyId, brandId: r.brandId, countryId: r.countryId }}
            title={t("reg.docsCerts")}
          />
        </div>
      </div>
    </>
  );
}
