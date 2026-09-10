import type { Principal } from "@/lib/permissions/engine";
import { canAnywhere, accessibleScopeIds } from "@/lib/permissions/engine";
import { prisma } from "@/lib/db";
import { scopedWhere, DIMS_CBC } from "@/domain/scope";
import { humanize } from "@/lib/status";
import { searchKnowledge } from "@/domain/knowledge";
import { findApprovedAnswers } from "@/domain/answers";
import { listFiles } from "@/domain/files";
import { searchMessages } from "@/domain/discussions";

/**
 * Universal search (§54-55) — the single source of truth for cross-entity search,
 * shared by the /api/v1/search route and the Cmd/K command palette. Every branch is
 * permission-gated (canAnywhere) AND scope-filtered (scopedWhere / accessibleScopeIds),
 * so results never leak records the caller cannot see (§29, §69). Branches run in
 * parallel; each is capped so one noisy type cannot crowd out the rest.
 */
export interface SearchHit {
  type: string;
  id: string;
  title: string;
  subtitle?: string;
  href: string;
}

/** Minimum query length before search runs (avoids fanning out on a single keystroke). */
export const SEARCH_MIN_QUERY = 2;

const clip = (s: string, n = 80) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

export async function globalSearch(principal: Principal, rawQuery: string, opts: { perType?: number } = {}): Promise<SearchHit[]> {
  const q = rawQuery.trim();
  if (q.length < SEARCH_MIN_QUERY) return [];
  const TAKE = opts.perType ?? 5;
  const like = { contains: q, mode: "insensitive" as const };
  const branches: Promise<SearchHit[]>[] = [];

  if (canAnywhere(principal, "brands.view")) {
    const ids = accessibleScopeIds(principal, "brands.view", "brandId");
    branches.push(
      prisma.brand
        .findMany({ where: { archivedAt: null, name: like, ...(ids === "all" ? {} : { id: { in: ids } }) }, take: TAKE })
        .then((rows) => rows.map((b) => ({ type: "brand", id: b.id, title: b.name, subtitle: "Brand", href: `/brands/${b.id}` }))),
    );
  }
  if (canAnywhere(principal, "products.view")) {
    branches.push(
      prisma.product
        .findMany({ where: scopedWhere(principal, "products.view", ["brandId"], { archivedAt: null, OR: [{ name: like }, { sku: like }] }), take: TAKE })
        .then((rows) => rows.map((p) => ({ type: "product", id: p.id, title: p.name, subtitle: p.sku, href: `/products/${p.id}` }))),
    );
  }
  if (canAnywhere(principal, "campaigns.view")) {
    branches.push(
      prisma.campaign
        .findMany({ where: scopedWhere(principal, "campaigns.view", DIMS_CBC, { archivedAt: null, name: like }), take: TAKE })
        .then((rows) => rows.map((c) => ({ type: "campaign", id: c.id, title: c.name, subtitle: "Campaign", href: `/campaigns/${c.id}` }))),
    );
  }
  if (canAnywhere(principal, "tasks.view")) {
    branches.push(
      prisma.task
        .findMany({ where: scopedWhere(principal, "tasks.view", DIMS_CBC, { archivedAt: null, title: like }), take: TAKE })
        .then((rows) => rows.map((t) => ({ type: "task", id: t.id, title: t.title, subtitle: "Task", href: `/tasks/${t.id}` }))),
    );
  }
  if (canAnywhere(principal, "cases.view")) {
    branches.push(
      prisma.customerCase
        .findMany({ where: scopedWhere(principal, "cases.view", DIMS_CBC, { archivedAt: null, description: like }), take: TAKE })
        .then((rows) => rows.map((c) => ({ type: "case", id: c.id, title: humanize(c.type), subtitle: c.description ?? "Case", href: `/cases/${c.id}` }))),
    );
  }
  if (canAnywhere(principal, "registrations.view")) {
    branches.push(
      prisma.registrationCase
        .findMany({ where: scopedWhere(principal, "registrations.view", DIMS_CBC, { archivedAt: null, registrationNumber: like }), take: TAKE })
        .then((rows) => rows.map((r) => ({ type: "registration", id: r.id, title: r.registrationNumber ?? "Registration case", subtitle: "Registration", href: `/registrations/${r.id}` }))),
    );
  }
  if (canAnywhere(principal, "subscriptions.view")) {
    branches.push(
      prisma.subscription
        .findMany({ where: scopedWhere(principal, "subscriptions.view", DIMS_CBC, { archivedAt: null, OR: [{ provider: like }, { plan: like }] }), take: TAKE })
        .then((rows) => rows.map((s) => ({ type: "subscription", id: s.id, title: s.provider, subtitle: s.plan ?? "Subscription", href: `/subscriptions/${s.id}` }))),
    );
  }
  if (canAnywhere(principal, "stores.view")) {
    branches.push(
      prisma.store
        .findMany({ where: scopedWhere(principal, "stores.view", DIMS_CBC, { archivedAt: null, name: like }), take: TAKE })
        .then((rows) => rows.map((s) => ({ type: "store", id: s.id, title: s.name, subtitle: humanize(s.platform), href: `/stores/${s.id}` }))),
    );
  }

  // Knowledge, approved answers, files, and discussion messages — permission + scope aware.
  if (canAnywhere(principal, "knowledge.view")) {
    branches.push(searchKnowledge(principal, q, TAKE).then((rows) => rows.map((a) => ({ type: "knowledge", id: a.id, title: a.title, subtitle: "Knowledge", href: `/knowledge/${a.id}` }))));
  }
  if (canAnywhere(principal, "answers.view")) {
    branches.push(findApprovedAnswers(principal, { q }).then((rows) => rows.slice(0, TAKE).map((a) => ({ type: "answer", id: a.id, title: a.question, subtitle: "Approved answer", href: `/answers/${a.id}` }))));
  }
  if (canAnywhere(principal, "files.view")) {
    branches.push(listFiles(principal, { q, page: 1, pageSize: TAKE } as never).then(({ rows }) => rows.map((f) => ({ type: "file", id: f.id, title: f.name, subtitle: "File", href: `/files/${f.id}` }))));
  }
  if (canAnywhere(principal, "discussions.view")) {
    branches.push(
      searchMessages(principal, q, TAKE).then((rows) =>
        rows.map((m) => ({ type: "message", id: m.id, title: clip(m.body), subtitle: `#${m.channelName}`, href: `/discussions/${m.channelId}` })),
      ),
    );
  }

  return (await Promise.all(branches)).flat();
}
