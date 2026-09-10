import type { Metadata } from "next";
import type { Project } from "@prisma/client";
import { pageGuard } from "@/lib/page-guard";
import { AccessDenied } from "@/components/access-denied";
import { canAnywhere } from "@/lib/permissions/engine";
import { listProjects, projectQuerySchema } from "@/domain/projects";
import { getLookups, refName } from "@/domain/lookups";
import { StatusBadge, EmptyState, type Column } from "@/components/ui";
import { ResourceList } from "@/components/list/resource-list";
import { BrandChip } from "@/components/entity-chips";
import { ProjectForm } from "@/components/org/org-forms";
import { formatDateShort } from "@/lib/format";

export const metadata: Metadata = { title: "Projects" };

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const { principal, locale, denied } = await pageGuard("projects.view");
  if (denied) return <AccessDenied locale={locale} />;
  const sp = await searchParams;
  const query = projectQuerySchema.parse(sp);
  const [{ rows, total }, lookups] = await Promise.all([listProjects(principal, query), getLookups()]);
  const canCreate = canAnywhere(principal, "projects.create");
  const brandOpts = [...lookups.brands.values()].sort((a, b) => a.name.localeCompare(b.name)).map((b) => ({ id: b.id, label: b.name }));
  const companyOpts = [...lookups.companies.values()].sort((a, b) => a.name.localeCompare(b.name)).map((c) => ({ id: c.id, label: c.name }));
  const userOpts = [...lookups.users.values()].sort((a, b) => a.name.localeCompare(b.name)).map((u) => ({ id: u.id, label: u.name }));

  const columns: Column<Project>[] = [
    { key: "name", header: "Project", render: (p) => p.name },
    { key: "brand", header: "Brand", render: (p) => <BrandChip name={refName(lookups.brands, p.brandId)} color={p.brandId ? lookups.brands.get(p.brandId)?.meta : null} /> },
    { key: "due", header: "Due", align: "end", render: (p) => <span className="tabular text-ink-3">{formatDateShort(p.dueDate, locale)}</span> },
    { key: "status", header: "Status", render: (p) => <StatusBadge module="generic" status={p.status} /> },
    ...(canCreate ? [{ key: "edit", header: "", align: "end" as const, render: (p: Project) => <ProjectForm mode="edit" brands={brandOpts} companies={companyOpts} users={userOpts} defaults={{ id: p.id, name: p.name, brandId: p.brandId, companyId: p.companyId, status: p.status, dueDate: p.dueDate ? new Date(p.dueDate).toISOString().slice(0, 10) : "" }} /> }] : []),
  ];

  return (
    <ResourceList title="Projects" description="Group related work under a project." countLabel="projects" savedViewsModule="projects"
      searchPlaceholder="Search projects…" columns={columns} rows={rows} getRowKey={(p) => p.id}
      actions={canCreate ? <ProjectForm mode="create" brands={brandOpts} companies={companyOpts} users={userOpts} /> : undefined}
      page={query.page} pageSize={query.pageSize} total={total} params={sp}
      empty={<EmptyState title="No projects" description="Projects group tasks, creative and campaigns under one deliverable." />} />
  );
}
