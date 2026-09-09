import { z } from "zod";
import type { Document } from "@prisma/client";
import { prisma } from "@/lib/db";
import { assertRecordInScope, type Principal } from "@/lib/permissions/engine";
import { listQuerySchema } from "@/lib/api/pagination";
import { scopedWhere, DIMS_CBC } from "@/domain/scope";

/**
 * Documents & certificates with expiration tracking (§15). A Document carries
 * companyId/brandId/countryId, so its permission-derived scope filter uses
 * DIMS_CBC (§3, §69). Expiry state is derived from expiryDate at render time.
 */
export const documentQuerySchema = listQuerySchema.extend({
  status: z.string().optional(),
  brandId: z.string().optional(),
});
export type DocumentQuery = z.infer<typeof documentQuerySchema>;

/** DocumentType categories treated as regulatory certificates (§15). */
export const CERTIFICATE_CATEGORIES = ["regulatory", "certificate", "certification", "compliance"] as const;

export async function listDocuments(
  principal: Principal,
  query: DocumentQuery,
  restrict: Record<string, unknown> = {},
): Promise<{ rows: Document[]; total: number }> {
  const where: Record<string, unknown> = {
    archivedAt: null,
    ...scopedWhere(principal, "documents.view", DIMS_CBC, {
      ...restrict,
      ...(query.status ? { status: query.status } : {}),
      ...(query.brandId ? { brandId: query.brandId } : {}),
      ...(query.q ? { OR: [{ title: { contains: query.q, mode: "insensitive" } }, { number: { contains: query.q, mode: "insensitive" } }] } : {}),
    }),
  };

  const [rows, total] = await Promise.all([
    prisma.document.findMany({
      where,
      orderBy: { expiryDate: "asc" },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.document.count({ where }),
  ]);

  return { rows, total };
}

/**
 * Focused certificates view (§15): the same document store, narrowed to
 * regulatory certificate document types and ordered by soonest expiry. If no
 * certificate types are defined yet, it falls back to the full document set so
 * the view is never mysteriously empty.
 */
export async function getCertificatesView(
  principal: Principal,
  query: DocumentQuery,
): Promise<{ rows: Document[]; total: number }> {
  const types = await prisma.documentType.findMany({
    where: { category: { in: [...CERTIFICATE_CATEGORIES] } },
    select: { id: true },
  });
  const typeIds = types.map((t) => t.id);
  return listDocuments(principal, query, typeIds.length ? { documentTypeId: { in: typeIds } } : {});
}

/** Load a single document, fail-closed on scope (§69). */
export async function getDocument(principal: Principal, id: string) {
  const document = await prisma.document.findUnique({ where: { id } });
  if (!document) return null;
  assertRecordInScope(
    principal,
    "documents.view",
    { companyId: document.companyId, brandId: document.brandId, countryId: document.countryId },
    DIMS_CBC,
  );
  return { document };
}

/**
 * DocumentType id -> display name. Types are a small master set, resolved in
 * bulk for name rendering (avoids N+1) — they are not part of the global lookups.
 */
export async function getDocumentTypeNames(): Promise<Map<string, string>> {
  const types = await prisma.documentType.findMany({ select: { id: true, name: true } });
  return new Map(types.map((t) => [t.id, t.name]));
}

// ---------------------------------------------------------------------------
// CERTIFICATE / DOCUMENT EXPIRY REMINDERS (§22) — idempotent generator.
// Admin-configurable thresholds via SystemSetting `certificates.reminderThresholds`
// (falls back to a sensible default). Mirrors the subscription-reminders pattern:
// one most-urgent unsent threshold fired per document per run; all reached
// thresholds marked sent (per expiryDate) so re-runs never double-notify.
// ---------------------------------------------------------------------------
export const DEFAULT_CERT_THRESHOLDS = [180, 120, 90, 60, 30, 14, 7, 1];

async function certThresholds(): Promise<number[]> {
  const row = await prisma.systemSetting.findUnique({ where: { key: "certificates.reminderThresholds" } }).catch(() => null);
  if (row) {
    try {
      const v = JSON.parse(row.valueJson);
      if (Array.isArray(v) && v.every((n) => typeof n === "number")) return [...v].sort((a, b) => b - a);
    } catch { /* fall through to default */ }
  }
  return DEFAULT_CERT_THRESHOLDS;
}

export async function generateCertificateReminders(actorId: string | null, now: Date = new Date()): Promise<{ scanned: number; notified: number }> {
  const { notify } = await import("@/domain/mutation");
  const thresholds = await certThresholds();

  await prisma.backgroundJob.upsert({
    where: { id: "certificate-reminders" },
    update: { lastRunAt: now, status: "running" },
    create: { id: "certificate-reminders", name: "Certificate & document expiry reminders", type: "recurring", scheduleCron: "0 6 * * *", status: "running", lastRunAt: now },
  }).catch(() => {});

  const docs = await prisma.document.findMany({
    where: { archivedAt: null, expiryDate: { not: null, gte: now } },
    select: { id: true, title: true, expiryDate: true, ownerId: true, brandId: true, companyId: true, remindersSentJson: true },
    take: 2000,
  });

  let notified = 0;
  for (const d of docs) {
    if (!d.expiryDate) continue;
    const daysLeft = Math.ceil((d.expiryDate.getTime() - now.getTime()) / 86_400_000);
    if (daysLeft < 0) continue;
    const sent: number[] = (() => { try { return JSON.parse(d.remindersSentJson ?? "[]"); } catch { return []; } })();
    const reached = thresholds.filter((t) => t >= daysLeft);
    const unsent = reached.filter((t) => !sent.includes(t));
    if (unsent.length === 0) continue;
    if (d.ownerId) {
      await notify([d.ownerId], {
        type: "certificate.expiring",
        title: `Expiring in ${daysLeft}d: ${d.title}`,
        body: `This document expires on ${d.expiryDate.toISOString().slice(0, 10)}. Start renewal to avoid a lapse.`,
        entityType: "Document", entityId: d.id,
      });
      notified++;
    }
    await prisma.document.update({ where: { id: d.id }, data: { remindersSentJson: JSON.stringify([...new Set([...sent, ...reached])]), status: daysLeft <= 30 ? "expiring" : undefined } });
  }

  await prisma.backgroundJob.update({ where: { id: "certificate-reminders" }, data: { status: "success", nextRunAt: new Date(now.getTime() + 86_400_000) } }).catch(() => {});
  return { scanned: docs.length, notified };
}
