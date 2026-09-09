import { cache } from "react";
import { prisma } from "@/lib/db";

export interface RefItem {
  id: string;
  name: string;
  meta?: string | null;
}

export interface Lookups {
  brands: Map<string, RefItem>;
  countries: Map<string, RefItem>;
  companies: Map<string, RefItem>;
  users: Map<string, RefItem>;
  products: Map<string, RefItem>;
}

/**
 * Batch reference-name resolution. Cross-domain relations are stored as scalar
 * ids (see schema convention); the service layer resolves display names in bulk
 * here to avoid N+1 queries. Reference sets are small (brands, countries,
 * companies, users), so loading them once per request is efficient.
 */
export const getLookups = cache(async (): Promise<Lookups> => {
  const [brands, countries, companies, users, products] = await Promise.all([
    prisma.brand.findMany({ select: { id: true, name: true, accentColor: true } }),
    prisma.country.findMany({ select: { id: true, name: true, iso2: true } }),
    prisma.company.findMany({ select: { id: true, name: true, code: true } }),
    prisma.user.findMany({ select: { id: true, name: true, avatarColor: true } }),
    prisma.product.findMany({ select: { id: true, name: true, sku: true } }),
  ]);
  return {
    brands: new Map(brands.map((b) => [b.id, { id: b.id, name: b.name, meta: b.accentColor }])),
    countries: new Map(countries.map((c) => [c.id, { id: c.id, name: c.name, meta: c.iso2 }])),
    companies: new Map(companies.map((c) => [c.id, { id: c.id, name: c.name, meta: c.code }])),
    users: new Map(users.map((u) => [u.id, { id: u.id, name: u.name, meta: u.avatarColor }])),
    products: new Map(products.map((p) => [p.id, { id: p.id, name: p.name, meta: p.sku }])),
  };
});

export function refName(map: Map<string, RefItem>, id: string | null | undefined, fallback = "—"): string {
  if (!id) return fallback;
  return map.get(id)?.name ?? fallback;
}
