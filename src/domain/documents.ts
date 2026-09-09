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
      ...(query.q ? { OR: [{ title: { contains: query.q } }, { number: { contains: query.q } }] } : {}),
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
