import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { pageGuard } from "@/lib/page-guard";
import { AccessDenied } from "@/components/access-denied";
import { ForbiddenError } from "@/lib/permissions/engine";
import { getCase } from "@/domain/cases";
import { getLookups, refName } from "@/domain/lookups";
import { Panel, PanelHeader, PanelBody, StatusBadge, Badge } from "@/components/ui";
import { BrandChip, CountryChip, UserChip } from "@/components/entity-chips";
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
  const lookups = await getLookups();

  return (
    <>
      <div className="mb-1 text-xs text-ink-3"><Link href="/cases" className="hover:text-ink-2">Cases</Link> / {humanize(c.type)}</div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-lg font-semibold tracking-tight text-ink">{humanize(c.type)}</h1>
        <StatusBadge module="customer_case" status={c.status} />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel className="lg:col-span-2">
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
          <PanelHeader title="Details" />
          <PanelBody>
            <dl className="space-y-2.5 text-[13px]">
              <div className="flex justify-between"><dt className="text-ink-3">Brand</dt><dd><BrandChip name={refName(lookups.brands, c.brandId)} color={c.brandId ? lookups.brands.get(c.brandId)?.meta : null} /></dd></div>
              <div className="flex justify-between"><dt className="text-ink-3">Country</dt><dd><CountryChip name={refName(lookups.countries, c.countryId)} iso2={c.countryId ? lookups.countries.get(c.countryId)?.meta : null} /></dd></div>
              <div className="flex justify-between"><dt className="text-ink-3">Priority</dt><dd className="capitalize text-ink">{c.priority}</dd></div>
              <div className="flex justify-between"><dt className="text-ink-3">Assigned</dt><dd><UserChip name={refName(lookups.users, c.assignedToId)} color={c.assignedToId ? lookups.users.get(c.assignedToId)?.meta : null} /></dd></div>
              <div className="flex justify-between"><dt className="text-ink-3">Order ref</dt><dd className="text-ink">{c.orderRef ?? "—"}</dd></div>
            </dl>
          </PanelBody>
        </Panel>
      </div>
    </>
  );
}
