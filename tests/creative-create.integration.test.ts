import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { createCreativeAsset, approveCreativeAsset } from "@/domain/creative";
import type { ActorContext } from "@/lib/action";
import type { Principal } from "@/lib/permissions/engine";

/**
 * Regression for audit DOM-03: the Creative Library gained a write path. Exercises
 * the real domain function — scope-guarded create, tag→JSON-text normalization,
 * required brand, and the approve transition.
 *
 * DB-gated: skips when no Postgres is reachable; runs in CI.
 */
const SUPER: Principal = { userId: "audit-cl", isSuperAdmin: true, assignments: [] };
const CTX: ActorContext = { principal: SUPER, ip: null, userAgent: null };
const P = "cltest_";
const brand = P + "brand";

let dbUp = false;
beforeAll(async () => {
  try { await prisma.$queryRaw`select 1`; dbUp = true; } catch { dbUp = false; return; }
  await cleanup();
  await prisma.brand.create({ data: { id: brand, name: "CL Brand", code: "CLB", slug: "cl-brand-test" } });
});
afterAll(async () => { if (dbUp) await cleanup(); });

async function cleanup() {
  await prisma.creativeAsset.deleteMany({ where: { brandId: brand } }).catch(() => {});
  await prisma.brand.deleteMany({ where: { id: brand } }).catch(() => {});
}

describe("DOM-03 — add a creative asset to the library", () => {
  it("creates an asset and normalizes comma-separated tags to a JSON array", async () => {
    if (!dbUp) return;
    const asset = await createCreativeAsset(CTX, {
      assetType: "reel", brandId: brand, platform: "Instagram", tags: "summer, launch , kw",
    });
    expect(asset.assetType).toBe("reel");
    expect(asset.brandId).toBe(brand);
    expect(asset.approvedAt).toBeNull();
    expect(JSON.parse(asset.tagsJson ?? "[]")).toEqual(["summer", "launch", "kw"]);
  });

  it("rejects an asset with no brand (its scope dimension)", async () => {
    if (!dbUp) return;
    await expect(createCreativeAsset(CTX, { assetType: "post", brandId: "" })).rejects.toThrow();
  });

  it("rejects an unknown asset type", async () => {
    if (!dbUp) return;
    await expect(createCreativeAsset(CTX, { assetType: "hologram", brandId: brand })).rejects.toThrow();
  });

  it("approves an asset (idempotent timestamp)", async () => {
    if (!dbUp) return;
    const asset = await createCreativeAsset(CTX, { assetType: "banner", brandId: brand });
    const approved = await approveCreativeAsset(CTX, asset.id);
    expect(approved.approvedAt).toBeInstanceOf(Date);
    const first = approved.approvedAt;
    const again = await approveCreativeAsset(CTX, asset.id);
    expect(again.approvedAt?.getTime()).toBe(first?.getTime()); // not re-stamped
  });
});
