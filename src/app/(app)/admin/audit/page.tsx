import type { Metadata } from "next";
import { History } from "lucide-react";
import { pageGuard } from "@/lib/page-guard";
import { AccessDenied } from "@/components/access-denied";
import { listAudit, auditQuerySchema } from "@/domain/audit";
import { PageHeader, Panel, DataTable, EmptyState, type Column } from "@/components/ui";
import { ListToolbar } from "@/components/list/toolbar";
import { Pagination } from "@/components/list/pagination";
import { UserChip } from "@/components/entity-chips";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Audit Log" };

type Row = Awaited<ReturnType<typeof listAudit>>["rows"][number];

export default async function AuditPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const { locale, denied } = await pageGuard("audit.view");
  if (denied) return <AccessDenied locale={locale} />;
  const sp = await searchParams;
  const query = auditQuerySchema.parse(sp);
  const { rows, total, entityTypes } = await listAudit(query);

  const columns: Column<Row>[] = [
    { key: "time", header: "Time", render: (l) => <span className="tabular text-ink-3">{formatDateTime(l.createdAt, locale)}</span> },
    { key: "actor", header: "Actor", render: (l) => (l.actor ? <UserChip name={l.actor.name} color={l.actor.avatarColor} /> : <span className="text-ink-3">System</span>) },
    { key: "action", header: "Action", render: (l) => <span className="font-mono text-[11.5px] text-ink-2">{l.action}</span> },
    { key: "entity", header: "Entity", render: (l) => <span className="text-ink">{l.entityType}</span> },
    { key: "summary", header: "Summary", render: (l) => <span className="text-ink-2">{l.summary ?? "—"}</span> },
  ];

  return (
    <>
      <PageHeader title="Audit Log" description="Every sensitive business action, in a readable timeline (§31)." />
      <ListToolbar placeholder="Search actions…" filters={[{ name: "entityType", label: "Entity", options: entityTypes.map((e) => ({ value: e, label: e })) }]} />
      <Panel>
        <DataTable columns={columns} rows={rows} getRowKey={(l) => l.id}
          empty={<EmptyState icon={<History className="h-5 w-5" />} title="No audit entries" description="Permission changes, approvals, edits and status changes are recorded here." />} />
        {total > query.pageSize && <Pagination page={query.page} pageSize={query.pageSize} total={total} params={sp} />}
      </Panel>
    </>
  );
}
