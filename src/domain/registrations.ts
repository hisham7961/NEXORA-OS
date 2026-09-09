import { z } from "zod";
import type { RegistrationCase } from "@prisma/client";
import { prisma } from "@/lib/db";
import { assertRecordInScope, type Principal } from "@/lib/permissions/engine";
import { listQuerySchema } from "@/lib/api/pagination";
import { scopedWhere, DIMS_CBC } from "@/domain/scope";

/**
 * Global registration engine (§14). A RegistrationCase carries
 * companyId/brandId/countryId, so its permission-derived scope filter uses
 * DIMS_CBC — every list and single-record read is fenced to the caller's scope
 * server-side (§3, §69).
 */
export const registrationQuerySchema = listQuerySchema.extend({
  status: z.string().optional(),
  brandId: z.string().optional(),
  countryId: z.string().optional(),
  /** "blocked" = any stage waiting on the group (docs, requirements, payment, samples, rejection). */
  filter: z.string().optional(),
});
export type RegistrationQuery = z.infer<typeof registrationQuerySchema>;

/** Workflow stages where the case is stalled and needs the group to act (§14). */
export const BLOCKED_STATUSES = [
  "documents_missing",
  "additional_requirements",
  "payment_required",
  "samples_requested",
  "rejected",
] as const;

export async function listRegistrations(
  principal: Principal,
  query: RegistrationQuery,
): Promise<{ rows: RegistrationCase[]; total: number }> {
  const statusFilter = query.status
    ? { status: query.status }
    : query.filter === "blocked"
      ? { status: { in: [...BLOCKED_STATUSES] } }
      : {};

  const where: Record<string, unknown> = {
    archivedAt: null,
    ...scopedWhere(principal, "registrations.view", DIMS_CBC, {
      ...statusFilter,
      ...(query.brandId ? { brandId: query.brandId } : {}),
      ...(query.countryId ? { countryId: query.countryId } : {}),
      ...(query.q ? { OR: [{ registrationNumber: { contains: query.q, mode: "insensitive" } }] } : {}),
    }),
  };

  const [rows, total] = await Promise.all([
    prisma.registrationCase.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.registrationCase.count({ where }),
  ]);

  return { rows, total };
}

/**
 * Full case context (§14): the case, its chronological event timeline and the
 * required-documents checklist. Fail-closed on scope so a brand/country-scoped
 * user cannot open a case outside their reach (§69).
 */
export async function getRegistration(principal: Principal, id: string) {
  const registration = await prisma.registrationCase.findUnique({ where: { id } });
  if (!registration) return null;
  assertRecordInScope(
    principal,
    "registrations.view",
    { companyId: registration.companyId, brandId: registration.brandId, countryId: registration.countryId },
    DIMS_CBC,
  );

  const [events, docReqs] = await Promise.all([
    prisma.registrationEvent.findMany({ where: { caseId: id }, orderBy: { createdAt: "desc" } }),
    prisma.registrationDocReq.findMany({ where: { caseId: id }, orderBy: { createdAt: "asc" } }),
  ]);

  return { registration, events, docReqs };
}

/**
 * Authority id -> display name. RegulatoryAuthority is not a global lookup, so
 * the service resolves the small set in bulk for name rendering (avoids N+1).
 */
export async function getAuthorityNames(): Promise<Map<string, string>> {
  const authorities = await prisma.regulatoryAuthority.findMany({ select: { id: true, name: true } });
  return new Map(authorities.map((a) => [a.id, a.name]));
}
