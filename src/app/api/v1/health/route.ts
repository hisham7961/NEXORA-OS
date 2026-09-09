import { prisma } from "@/lib/db";
import { ok, fail } from "@/lib/api/response";

/**
 * Public health probe for the versioned API (§37, §75). Reports DB connectivity
 * and API version without leaking internals. No auth required.
 */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return ok({ status: "ok", api: "v1", time: new Date().toISOString(), database: "connected" });
  } catch {
    return fail("unhealthy", "Database connectivity check failed", 503);
  }
}
