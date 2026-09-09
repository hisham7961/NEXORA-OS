import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { pageGuard } from "@/lib/page-guard";
import { AccessDenied } from "@/components/access-denied";
import { ForbiddenError } from "@/lib/permissions/engine";
import { getDesign } from "@/domain/design";
import { getLookups, refName } from "@/domain/lookups";
import { Panel, PanelHeader, PanelBody, StatusBadge, Badge } from "@/components/ui";
import { BrandChip, UserChip } from "@/components/entity-chips";
import { formatDate, formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Design Request" };

export default async function DesignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { principal, locale } = await pageGuard("design.view");
  const { id } = await params;
  let req;
  try {
    req = await getDesign(principal, id);
  } catch (e) {
    if (e instanceof ForbiddenError) return <AccessDenied locale={locale} />;
    throw e;
  }
  if (!req) notFound();
  const lookups = await getLookups();

  return (
    <>
      <div className="mb-1 text-xs text-ink-3"><Link href="/design" className="hover:text-ink-2">Design</Link> / {req.assetType}</div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold capitalize tracking-tight text-ink">{req.assetType}{req.dimensions ? ` · ${req.dimensions}` : ""}</h1>
        <StatusBadge module="design" status={req.status} />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel className="lg:col-span-2">
          <PanelHeader title="Versions" description="History is preserved — an approved creative is never overwritten (§12)." />
          <PanelBody>
            {req.versions.length === 0 ? <p className="text-[13px] text-ink-3">No versions uploaded yet.</p> : (
              <ul className="space-y-2">
                {req.versions.map((v) => (
                  <li key={v.id} className="flex items-center justify-between rounded-md border border-line bg-surface-2/40 px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-ink-2">v{v.version}</span>
                      <span className="text-[13px] text-ink">{refName(lookups.users, v.uploadedById)}</span>
                      <span className="text-[11px] text-ink-3">{formatDateTime(v.createdAt, locale)}</span>
                    </div>
                    {v.isApproved ? <Badge category="success" dot>Approved</Badge> : v.isRejected ? <Badge category="critical" dot>Rejected</Badge> : <Badge category="neutral">Draft</Badge>}
                  </li>
                ))}
              </ul>
            )}
          </PanelBody>
        </Panel>
        <Panel>
          <PanelHeader title="Brief" />
          <PanelBody>
            <dl className="space-y-2.5 text-[13px]">
              <div className="flex justify-between"><dt className="text-ink-3">Brand</dt><dd><BrandChip name={refName(lookups.brands, req.brandId)} color={req.brandId ? lookups.brands.get(req.brandId)?.meta : null} /></dd></div>
              <div className="flex justify-between"><dt className="text-ink-3">Requester</dt><dd><UserChip name={refName(lookups.users, req.requesterId)} color={req.requesterId ? lookups.users.get(req.requesterId)?.meta : null} /></dd></div>
              <div className="flex justify-between"><dt className="text-ink-3">Designer</dt><dd><UserChip name={refName(lookups.users, req.designerId)} color={req.designerId ? lookups.users.get(req.designerId)?.meta : null} /></dd></div>
              <div className="flex justify-between"><dt className="text-ink-3">Deadline</dt><dd className="text-ink">{formatDate(req.deadline, locale)}</dd></div>
              <div className="flex justify-between"><dt className="text-ink-3">Platform</dt><dd className="text-ink">{req.platform ?? "—"}</dd></div>
            </dl>
            {req.copy && <div className="mt-3 rounded-md bg-surface-2/50 p-2.5 text-[13px] text-ink-2">{req.copy}</div>}
          </PanelBody>
        </Panel>
      </div>
    </>
  );
}
