import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { pageGuard } from "@/lib/page-guard";
import { AccessDenied } from "@/components/access-denied";
import { canAnywhere, ForbiddenError } from "@/lib/permissions/engine";
import { getCase } from "@/domain/cases";
import { getActivity } from "@/domain/mutation";
import { getScopedOptions } from "@/domain/options";
import { getLookups, refName } from "@/domain/lookups";
import { Panel, PanelHeader, PanelBody, StatusBadge, Badge } from "@/components/ui";
import { BrandChip, CountryChip, UserChip } from "@/components/entity-chips";
import { ActivityTimeline, type TimelineEntry } from "@/components/activity-timeline";
import { EntityFiles } from "@/components/files/entity-files";
import { CaseActionBar } from "@/components/cases/case-actions";
import { formatDateTime } from "@/lib/format";
import { humanize } from "@/lib/status";

export const metadata: Metadata = { title: "Customer Case" };

export default async function CaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { principal, locale } = await pageGuard("cases.view");
  const { id } = await params;
  let c;
  try {
    c = await getCase(principal, id);
  } catch (e) {
    if (e instanceof ForbiddenError) return <AccessDenied locale={locale} />;
    throw e;
  }
  if (!c) notFound();

  const canEdit = canAnywhere(principal, "cases.edit");
  const [lookups, activity, options] = await Promise.all([
    getLookups(),
    getActivity("CustomerCase", id),
    canEdit ? getScopedOptions(principal, "cases.edit") : Promise.resolve(null),
  ]);
  const timeline: TimelineEntry[] = activity.map((a) => ({
    id: a.id, at: a.at, actorName: a.actorId ? refName(lookups.users, a.actorId) : "System",
    actorColor: a.actorId ? lookups.users.get(a.actorId)?.meta : null, action: a.action, summary: a.summary,
  }));

  return (
    <>
      <div className="mb-1 text-xs text-ink-3"><Link href="/cases" className="hover:text-ink-2">Cases</Link> / {humanize(c.type)}</div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-lg font-semibold tracking-tight text-ink">{humanize(c.type)}</h1>
        <div className="flex items-center gap-2"><Badge className="capitalize">{c.priority}</Badge><StatusBadge module="customer_case" status={c.status} /></div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Panel>
            <PanelHeader title="Case" />
            <PanelBody className="space-y-3">
              <p className="text-[13px] text-ink-2">{c.description ?? "No description."}</p>
              {c.resolution && <div><div className="text-[11px] font-semibold uppercase tracking-wide text-ink-3">Resolution</div><p className="mt-1 text-[13px] text-ink">{c.resolution}</p></div>}
              <div>
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-3">Notes</div>
                {c.notes.length === 0 ? <p className="text-[13px] text-ink-3">No notes.</p> : (
                  <ul className="space-y-2">
                    {c.notes.map((n) => (
                      <li key={n.id} className="rounded-md border border-line bg-surface-2/40 p-2.5 text-[13px]">
                        <div className="mb-1 flex items-center justify-between text-[11px] text-ink-3"><span>{refName(lookups.users, n.authorId)}</span><span>{formatDateTime(n.createdAt, locale)}</span></div>
                        {n.body}{n.isInternal && <Badge className="ms-2" category="neutral">Internal</Badge>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </PanelBody>
          </Panel>
          <Panel>
            <PanelHeader title="Activity" />
            <PanelBody><ActivityTimeline entries={timeline} locale={locale} empty="No activity yet." /></PanelBody>
          </Panel>
          <EntityFiles principal={principal} entityType="CustomerCase" entityId={c.id} scope={{ companyId: c.companyId, brandId: c.brandId, countryId: c.countryId }} />
        </div>

        <div className="space-y-4">
          {canEdit && options && (
            <Panel>
              <PanelHeader title="Actions" />
              <PanelBody><CaseActionBar caseId={c.id} status={c.status} users={options.users} assignedToId={c.assignedToId} /></PanelBody>
            </Panel>
          )}
          <Panel>
            <PanelHeader title="Details" />
            <PanelBody>
              <dl className="space-y-2.5 text-[13px]">
                <div className="flex justify-between"><dt className="text-ink-3">Brand</dt><dd><BrandChip name={refName(lookups.brands, c.brandId)} color={c.brandId ? lookups.brands.get(c.brandId)?.meta : null} /></dd></div>
                <div className="flex justify-between"><dt className="text-ink-3">Country</dt><dd><CountryChip name={refName(lookups.countries, c.countryId)} iso2={c.countryId ? lookups.countries.get(c.countryId)?.meta : null} /></dd></div>
                <div className="flex justify-between"><dt className="text-ink-3">Assigned</dt><dd><UserChip name={refName(lookups.users, c.assignedToId)} color={c.assignedToId ? lookups.users.get(c.assignedToId)?.meta : null} /></dd></div>
                <div className="flex justify-between"><dt className="text-ink-3">Order ref</dt><dd className="text-ink">{c.orderRef ?? "—"}</dd></div>
                <div className="flex justify-between"><dt className="text-ink-3">Customer</dt><dd className="text-ink">{c.customerRef ?? "—"}</dd></div>
              </dl>
            </PanelBody>
          </Panel>
        </div>
      </div>
    </>
  );
}
