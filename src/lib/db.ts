import { PrismaClient } from "@prisma/client";

/**
 * Prisma singleton. In dev, Next.js hot-reloads modules repeatedly; without the
 * global cache we would exhaust the connection pool. All data access — from
 * server components, server actions AND the versioned REST API — flows through
 * this one client so the same domain/service layer is shared (API-first, §33).
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export type { Prisma } from "@prisma/client";
