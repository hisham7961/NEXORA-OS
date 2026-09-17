import type { Metadata } from "next";
import { History } from "lucide-react";
import { pageGuard } from "@/lib/page-guard";
import { getServerI18n } from "@/lib/server-i18n";
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
  const { t } = await getServerI18n();
  const sp = await searchParams;
  const query = auditQuerySchema.parse(sp);
  const { rows, total, entityTypes } = await listAudit(query);

  const columns: Column<Row>[] = [
    { key: "time", header: t("admin.col.time"), render: (l) => <span className="tabular text-ink-3">{formatDateTime(l.createdAt, locale)}</span> },
    { key: "actor", header: t("admin.col.actor"), render: (l) => (l.actor ? <UserChip name={l.actor.name} color={l.actor.avatarColor} /> : <span className="text-ink-3">{t("common.system")}</span>) },
    { key: "action", header: t("admin.col.action"), render: (l) => <span className="font-mono text-[11.5px] text-ink-2">{l.action}</span> },
    { key: "entity", header: t("admin.col.entity"), render: (l) => <span className="text-ink">{l.entityType}</span> },
    { key: "summary", header: t("admin.col.summary"), render: (l) => <span className="text-ink-2">{l.summary ?? "—"}</span> },
  ];

  return (
    <>
      <PageHeader title={t("admin.auditLog")} description={t("admin.auditSub")} />
      <ListToolbar placeholder={t("admin.searchActions")} filters={[{ name: "entityType", label: t("admin.col.entity"), options: entityTypes.map((e) => ({ value: e, label: e })) }]} />
      <Panel>
        <DataTable columns={columns} rows={rows} getRowKey={(l) => l.id}
          empty={<EmptyState icon={<History className="h-5 w-5" />} title={t("admin.noAuditEntries")} description={t("admin.noAuditEntriesSub")} />} />
        {total > query.pageSize && <Pagination page={query.page} pageSize={query.pageSize} total={total} params={sp} />}
      </Panel>
    </>
  );
}
