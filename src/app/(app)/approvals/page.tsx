import Link from "next/link";
import type { Metadata } from "next";
import type { ApprovalRequest } from "@prisma/client";
import { Stamp } from "lucide-react";
import { pageGuard } from "@/lib/page-guard";
import { AccessDenied } from "@/components/access-denied";
import { listApprovals, getMyApprovals, approvalQuerySchema } from "@/domain/approvals";
import { getScopedOptions } from "@/domain/options";
import { NewApprovalButton } from "@/components/approvals/new-approval-button";
import { getLookups, refName } from "@/domain/lookups";
import { PageHeader, Panel, PanelHeader, DataTable, StatusBadge, Badge, EmptyState, type Column } from "@/components/ui";
import { ListToolbar } from "@/components/list/toolbar";
import { Pagination } from "@/components/list/pagination";
import { UserChip } from "@/components/entity-chips";
import { humanize } from "@/lib/status";

export const metadata: Metadata = { title: "Approvals" };

export default async function ApprovalsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const { principal, locale, denied } = await pageGuard("approvals.view");
  if (denied) return <AccessDenied locale={locale} />;
  const sp = await searchParams;
  const query = approvalQuerySchema.parse(sp);
  const [{ rows, total }, mine, lookups, options] = await Promise.all([
    listApprovals(principal, query),
    getMyApprovals(principal),
    getLookups(),
    getScopedOptions(principal, "approvals.view"),
  ]);

  const columns: Column<ApprovalRequest>[] = [
    { key: "title", header: "Title", render: (a) => a.title },
    { key: "type", header: "Type", render: (a) => <span className="capitalize">{humanize(a.type)}</span> },
    { key: "requester", header: "Requested by", render: (a) => <UserChip name={refName(lookups.users, a.requesterId)} color={a.requesterId ? lookups.users.get(a.requesterId)?.meta : null} /> },
    { key: "step", header: "Step", align: "center", render: (a) => <span className="tabular text-ink-3">{a.currentStep}</span> },
    { key: "status", header: "Status", render: (a) => <StatusBadge module="approval" status={a.status} /> },
  ];

  return (
    <>
      <PageHeader
        title="Approvals"
        description="A universal approval engine with multi-step routing (§24)."
        actions={<NewApprovalButton options={{ users: options.users, brands: options.brands, companies: options.companies }} />}
      />
      {mine.length > 0 && (
        <Panel className="mb-4">
          <PanelHeader title="Waiting for me" icon={<Stamp className="h-4 w-4" />} action={<Badge category="warning">{mine.length}</Badge>} />
          <ul className="divide-y divide-line">
            {mine.map((s) => (
              <li key={s.id}>
                <Link href={`/approvals/${s.requestId}`} className="flex items-center justify-between px-4 py-2.5 hover:bg-surface-2">
                  <span className="text-[13px] text-ink">{s.request.title}</span>
                  <Badge category="warning" dot>Step {s.order}</Badge>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      )}
      <ListToolbar placeholder="Search approvals…" filters={[{ name: "status", label: "Status", options: ["pending", "approved", "rejected", "changes"].map((v) => ({ value: v, label: v })) }]} />
      <Panel>
        <DataTable columns={columns} rows={rows} getRowKey={(a) => a.id} getRowHref={(a) => `/approvals/${a.id}`}
          empty={<EmptyState icon={<Stamp className="h-5 w-5" />} title="No approval requests" description="Campaigns, budgets, creative and expenses route here for sign-off." />} />
        {total > query.pageSize && <Pagination page={query.page} pageSize={query.pageSize} total={total} params={sp} />}
      </Panel>
    </>
  );
}
