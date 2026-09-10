import type { ReactNode } from "react";
import { PageHeader, Panel, DataTable, Badge, type Column } from "@/components/ui";
import { ListToolbar, type ToolbarFilter } from "@/components/list/toolbar";
import { Pagination } from "@/components/list/pagination";

interface ResourceListProps<T> {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  searchPlaceholder?: string;
  filters?: ToolbarFilter[];
  columns: Column<T>[];
  rows: T[];
  getRowKey: (row: T) => string;
  getRowHref?: (row: T) => string;
  empty: ReactNode;
  page: number;
  pageSize: number;
  total: number;
  params: Record<string, string | undefined>;
  countLabel?: string;
  savedViewsModule?: string;
}

/** Standard scoped list screen: header + URL-driven toolbar + dense table + pagination. */
export function ResourceList<T>({
  title, description, actions, searchPlaceholder, filters, columns, rows, getRowKey, getRowHref,
  empty, page, pageSize, total, params, countLabel, savedViewsModule,
}: ResourceListProps<T>) {
  return (
    <>
      <PageHeader title={title} description={description} actions={actions} meta={<Badge>{total} {countLabel ?? "records"}</Badge>} />
      <ListToolbar placeholder={searchPlaceholder} filters={filters} savedViewsModule={savedViewsModule} />
      <Panel>
        <DataTable columns={columns} rows={rows} getRowKey={getRowKey} getRowHref={getRowHref} empty={empty} />
        {total > pageSize && <Pagination page={page} pageSize={pageSize} total={total} params={params} />}
      </Panel>
    </>
  );
}
