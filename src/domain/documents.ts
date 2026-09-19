import { z } from "zod";
import type { Document } from "@prisma/client";
import { prisma } from "@/lib/db";
import { assertRecordInScope, type Principal } from "@/lib/permissions/engine";
import { listQuerySchema } from "@/lib/api/pagination";
import { scopedWhere, DIMS_CBC } from "@/domain/scope";
import { assertCan, audit, type ActorContext } from "@/domain/mutation";
import { ServiceError } from "@/lib/api/handler";
import { optionalString, requiredString } from "@/lib/validation";

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

/** Regulatory document types for the create form (id, name, category). */
export async function listDocumentTypes(): Promise<{ id: string; name: string; category: string | null }[]> {
  return prisma.documentType.findMany({ select: { id: true, name: true, category: true }, orderBy: { name: "asc" } });
}

const dateInput = z.preprocess((v) => (v === "" || v == null ? undefined : new Date(String(v))), z.date().optional());

export const documentCreateSchema = z.object({
  title: requiredString(200),
  documentTypeId: optionalString,
  companyId: optionalString,
  brandId: optionalString,
  countryId: optionalString,
  productId: optionalString,
  number: optionalString,
  issueDate: dateInput,
  expiryDate: dateInput,
  visibility: z.enum(["internal", "restricted"]).default("internal"),
});

/** Status derived from expiry at write time; the render layer + reminder job refine it. */
function documentStatus(expiryDate: Date | undefined | null): string {
  if (!expiryDate) return "valid";
  const days = Math.floor((expiryDate.getTime() - Date.now()) / 86400000);
  if (days < 0) return "expired";
  if (days <= 30) return "expiring";
  return "valid";
}

/**
 * Create a document / certificate (§15 — audit DOM-01/02). Certificates are just
 * Documents with a regulatory DocumentType, so this one path serves both screens.
 * Fail-closed on the NEW record's create scope, then audit.
 */
export async function createDocument(ctx: ActorContext, raw: unknown): Promise<Document> {
  const input = documentCreateSchema.parse(raw);
  const scope = { companyId: input.companyId ?? null, brandId: input.brandId ?? null, countryId: input.countryId ?? null };
  assertCan(ctx.principal, "documents.create", scope);
  const doc = await prisma.document.create({
    data: {
      ...scope,
      documentTypeId: input.documentTypeId ?? null,
      productId: input.productId ?? null,
      number: input.number ?? null,
      title: input.title,
      issueDate: input.issueDate ?? null,
      expiryDate: input.expiryDate ?? null,
      visibility: input.visibility,
      status: documentStatus(input.expiryDate),
      ownerId: ctx.principal.userId,
      createdById: ctx.principal.userId,
    },
  });
  await audit(ctx, { action: "document.created", entityType: "Document", entityId: doc.id, summary: `Document created: ${doc.title}`, brandId: doc.brandId, companyId: doc.companyId });
  return doc;
}

export const documentRenewSchema = z.object({ expiryDate: dateInput, number: optionalString });

/**
 * Renew a document / certificate: new expiry, bump version, reset the reminder
 * ledger so the expiry sweep re-arms (§15/§22). Fail-closed edit-scope guard (§69).
 */
export async function renewDocument(ctx: ActorContext, id: string, raw: unknown): Promise<Document> {
  const input = documentRenewSchema.parse(raw);
  if (!input.expiryDate) throw new ServiceError("expiry_required", "A new expiry date is required to renew.", 422);
  const existing = await prisma.document.findUnique({ where: { id } });
  if (!existing || existing.archivedAt) throw new ServiceError("not_found", "Document not found", 404);
  assertRecordInScope(ctx.principal, "documents.edit", { companyId: existing.companyId, brandId: existing.brandId, countryId: existing.countryId }, DIMS_CBC);
  const doc = await prisma.document.update({
    where: { id },
    data: {
      expiryDate: input.expiryDate,
      number: input.number ?? existing.number,
      version: { increment: 1 },
      status: documentStatus(input.expiryDate),
      remindersSentJson: null,
    },
  });
  await audit(ctx, { action: "document.renewed", entityType: "Document", entityId: doc.id, summary: `Renewed to v${doc.version}`, brandId: doc.brandId, companyId: doc.companyId });
  return doc;
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
  let thresholds = DEFAULT_CERT_THRESHOLDS;
  const row = await prisma.systemSetting.findUnique({ where: { key: "certificates.reminderThresholds" } }).catch(() => null);
  if (row) {
    try {
      const v = JSON.parse(row.valueJson);
      if (Array.isArray(v) && v.every((n) => typeof n === "number")) thresholds = [...v].sort((a, b) => b - a);
    } catch { /* fall through to default */ }
  }
  // Respect the admin's "start reminders N days before expiry" lead (audit DOM-04):
  // no reminder fires earlier than notifications.certificateExpiryDays.
  const lead = await certificateExpiryLeadDays();
  return lead != null ? thresholds.filter((t) => t <= lead) : thresholds;
}

/** notifications.certificateExpiryDays — max lead (days) before expiry to remind. */
async function certificateExpiryLeadDays(): Promise<number | null> {
  try {
    const { getSettingValue } = await import("@/domain/settings");
    const v = Number(await getSettingValue<number>("notifications.certificateExpiryDays"));
    return Number.isFinite(v) && v > 0 ? v : null;
  } catch {
    return null;
  }
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
