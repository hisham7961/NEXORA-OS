import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { createDocument, renewDocument } from "@/domain/documents";
import type { ActorContext } from "@/lib/action";
import type { Principal } from "@/lib/permissions/engine";

/**
 * Regression for audit DOM-01/02: Documents & Certificates gained a create/renew
 * path. Exercises the real domain functions (scope-guarded create, expiry-derived
 * status, and renew that bumps the version and resets the reminder ledger).
 *
 * DB-gated: skips when no Postgres is reachable; runs in CI.
 */
const SUPER: Principal = { userId: "audit-docs", isSuperAdmin: true, assignments: [] };
const CTX: ActorContext = { principal: SUPER, ip: null, userAgent: null };
const P = "doctest_";
const co = P + "co", dt = P + "dt";

let dbUp = false;
beforeAll(async () => {
  try { await prisma.$queryRaw`select 1`; dbUp = true; } catch { dbUp = false; return; }
  await cleanup();
  await prisma.company.create({ data: { id: co, name: "Doc Co", code: "DOCCO" } });
  await prisma.documentType.create({ data: { id: dt, name: "Free Sale Certificate", category: "regulatory" } });
});
afterAll(async () => { if (dbUp) await cleanup(); });

async function cleanup() {
  await prisma.document.deleteMany({ where: { companyId: co } }).catch(() => {});
  await prisma.documentType.deleteMany({ where: { id: dt } }).catch(() => {});
  await prisma.company.deleteMany({ where: { id: co } }).catch(() => {});
}

const iso = (d: Date) => d.toISOString().slice(0, 10);

describe("DOM-01/02 — create & renew a document/certificate", () => {
  it("creates a document with a future expiry as 'valid'", async () => {
    if (!dbUp) return;
    const future = new Date(Date.now() + 200 * 86400000);
    const doc = await createDocument(CTX, {
      title: "Free-sale certificate — Kuwait", documentTypeId: dt, companyId: co,
      countryId: null, brandId: null, number: "FSC-123", expiryDate: iso(future), visibility: "internal",
    });
    expect(doc.title).toContain("Free-sale");
    expect(doc.companyId).toBe(co);
    expect(doc.status).toBe("valid");
    expect(doc.version).toBe(1);
    expect(doc.ownerId).toBe("audit-docs");
    const persisted = await prisma.document.findUnique({ where: { id: doc.id } });
    expect(persisted?.number).toBe("FSC-123");
  });

  it("derives 'expired' from a past expiry date", async () => {
    if (!dbUp) return;
    const past = new Date(Date.now() - 5 * 86400000);
    const doc = await createDocument(CTX, { title: "Lapsed cert", companyId: co, expiryDate: iso(past) });
    expect(doc.status).toBe("expired");
  });

  it("renews: bumps version, updates expiry, resets the reminder ledger", async () => {
    if (!dbUp) return;
    const soon = new Date(Date.now() + 10 * 86400000);
    const doc = await createDocument(CTX, { title: "Renewable cert", companyId: co, expiryDate: iso(soon) });
    // Simulate that a reminder had already been sent for the current expiry.
    await prisma.document.update({ where: { id: doc.id }, data: { remindersSentJson: "[30,14]" } });

    const far = new Date(Date.now() + 400 * 86400000);
    const renewed = await renewDocument(CTX, doc.id, { expiryDate: iso(far) });
    expect(renewed.version).toBe(2);
    expect(renewed.status).toBe("valid");
    expect(renewed.remindersSentJson).toBeNull(); // re-armed for the new expiry
    expect(iso(renewed.expiryDate!)).toBe(iso(far));
  });

  it("rejects a renew with no new expiry date", async () => {
    if (!dbUp) return;
    const doc = await createDocument(CTX, { title: "No-expiry renew", companyId: co });
    await expect(renewDocument(CTX, doc.id, { expiryDate: "" })).rejects.toThrow();
  });
});
