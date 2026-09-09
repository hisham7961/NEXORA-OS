import { z } from "zod";
import type { WhatsappCampaign } from "@prisma/client";
import { prisma } from "@/lib/db";
import { type Principal } from "@/lib/permissions/engine";
import { listQuerySchema } from "@/lib/api/pagination";
import { scopedWhere } from "@/domain/scope";

/** WhatsApp campaigns (§11) — third-party executed; internal workflow only. */
export const whatsappQuerySchema = listQuerySchema.extend({ status: z.string().optional(), brandId: z.string().optional() });
export type WhatsappQuery = z.infer<typeof whatsappQuerySchema>;

export async function listWhatsapp(principal: Principal, query: WhatsappQuery): Promise<{ rows: WhatsappCampaign[]; total: number }> {
  const where: Record<string, unknown> = {
    archivedAt: null,
    ...scopedWhere(principal, "whatsapp.view", ["brandId", "countryId"], {
      ...(query.status ? { status: query.status } : {}),
      ...(query.brandId ? { brandId: query.brandId } : {}),
      ...(query.q ? { OR: [{ objective: { contains: query.q } }, { audience: { contains: query.q } }] } : {}),
    }),
  };
  const [rows, total] = await Promise.all([
    prisma.whatsappCampaign.findMany({ where, orderBy: { updatedAt: "desc" }, skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
    prisma.whatsappCampaign.count({ where }),
  ]);
  return { rows, total };
}
