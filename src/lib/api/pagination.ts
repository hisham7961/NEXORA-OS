import { z } from "zod";

/** Shared list-query params: pagination, search, sort (§57). */
export const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(25),
  q: z.string().trim().max(200).optional(),
  sort: z.string().max(60).optional(),
  order: z.enum(["asc", "desc"]).default("desc"),
});

export type ListQuery = z.infer<typeof listQuerySchema>;

export function parseListQuery(searchParams: URLSearchParams): ListQuery {
  return listQuerySchema.parse(Object.fromEntries(searchParams.entries()));
}

export function paginate(query: Pick<ListQuery, "page" | "pageSize">) {
  return { skip: (query.page - 1) * query.pageSize, take: query.pageSize };
}

export function pageMeta(total: number, query: Pick<ListQuery, "page" | "pageSize">) {
  return {
    page: query.page,
    pageSize: query.pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
  };
}
