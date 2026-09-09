import { route } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { prisma } from "@/lib/db";
import { canAnywhere, accessibleScopeIds } from "@/lib/permissions/engine";
import { scopedWhere, DIMS_CBC } from "@/domain/scope";
import { humanize } from "@/lib/status";

interface Hit {
  type: string;
  id: string;
  title: string;
  subtitle?: string;
  href: string;
}

/**
 * GET /api/v1/search — universal search across entity types. Every branch is
 * permission-gated AND scope-filtered, so results never leak records the caller
 * cannot see (§29, §69). Used by the Cmd/K command palette.
 */
export const GET = route(async ({ principal, req }) => {
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim();
  if (q.length < 2) return ok([] as Hit[]);

  const TAKE = 5;
  const tasks: Promise<Hit[]>[] = [];

  if (canAnywhere(principal, "brands.view")) {
    const ids = accessibleScopeIds(principal, "brands.view", "brandId");
    tasks.push(
      prisma.brand
        .findMany({ where: { archivedAt: null, name: { contains: q }, ...(ids === "all" ? {} : { id: { in: ids } }) }, take: TAKE })
        .then((rows) => rows.map((b) => ({ type: "brand", id: b.id, title: b.name, subtitle: "Brand", href: `/brands/${b.id}` }))),
    );
  }
  if (canAnywhere(principal, "products.view")) {
    tasks.push(
      prisma.product
        .findMany({ where: scopedWhere(principal, "products.view", ["brandId"], { archivedAt: null, OR: [{ name: { contains: q } }, { sku: { contains: q } }] }), take: TAKE })
        .then((rows) => rows.map((p) => ({ type: "product", id: p.id, title: p.name, subtitle: p.sku, href: `/products/${p.id}` }))),
    );
  }
  if (canAnywhere(principal, "campaigns.view")) {
    tasks.push(
      prisma.campaign
        .findMany({ where: scopedWhere(principal, "campaigns.view", DIMS_CBC, { archivedAt: null, name: { contains: q } }), take: TAKE })
        .then((rows) => rows.map((c) => ({ type: "campaign", id: c.id, title: c.name, subtitle: "Campaign", href: `/campaigns/${c.id}` }))),
    );
  }
  if (canAnywhere(principal, "tasks.view")) {
    tasks.push(
      prisma.task
        .findMany({ where: scopedWhere(principal, "tasks.view", DIMS_CBC, { archivedAt: null, title: { contains: q } }), take: TAKE })
        .then((rows) => rows.map((t) => ({ type: "task", id: t.id, title: t.title, subtitle: "Task", href: `/tasks/${t.id}` }))),
    );
  }
  if (canAnywhere(principal, "cases.view")) {
    tasks.push(
      prisma.customerCase
        .findMany({ where: scopedWhere(principal, "cases.view", DIMS_CBC, { archivedAt: null, description: { contains: q } }), take: TAKE })
        .then((rows) => rows.map((c) => ({ type: "case", id: c.id, title: humanize(c.type), subtitle: c.description ?? "Case", href: `/cases/${c.id}` }))),
    );
  }
  if (canAnywhere(principal, "registrations.view")) {
    tasks.push(
      prisma.registrationCase
        .findMany({ where: scopedWhere(principal, "registrations.view", DIMS_CBC, { archivedAt: null, registrationNumber: { contains: q } }), take: TAKE })
        .then((rows) => rows.map((r) => ({ type: "registration", id: r.id, title: r.registrationNumber ?? "Registration case", subtitle: "Registration", href: `/registrations/${r.id}` }))),
    );
  }

  const results = (await Promise.all(tasks)).flat();
  return ok(results);
});
