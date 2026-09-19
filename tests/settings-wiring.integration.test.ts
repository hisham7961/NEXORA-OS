import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { invalidateSettingsCache } from "@/domain/settings";
import { generateCertificateReminders } from "@/domain/documents";

/**
 * Regression for audit DOM-04: System Settings must actually drive behaviour.
 * Here: notifications.certificateExpiryDays caps how early certificate reminders
 * fire. With a 30-day lead, a document expiring in 100 days must NOT be reminded
 * (it would have been, at the 180/120-day default thresholds, when the setting
 * was inert), while one expiring in 20 days still is.
 *
 * DB-gated: skips when no Postgres is reachable; runs in CI.
 */
const P = "setwire_";
const owner = P + "owner", farDoc = P + "far", nearDoc = P + "near";
let dbUp = false;

beforeAll(async () => {
  try { await prisma.$queryRaw`select 1`; dbUp = true; } catch { dbUp = false; return; }
  await cleanup();
  await prisma.user.create({ data: { id: owner, email: owner + "@t.local", name: "Owner", passwordHash: "x" } });
  const now = Date.now();
  await prisma.document.create({ data: { id: farDoc, title: P + "far", ownerId: owner, status: "valid", expiryDate: new Date(now + 100 * 86400000), remindersSentJson: null } });
  await prisma.document.create({ data: { id: nearDoc, title: P + "near", ownerId: owner, status: "valid", expiryDate: new Date(now + 20 * 86400000), remindersSentJson: null } });
  // Lead = 30 days: no reminder should start earlier than 30 days before expiry.
  await prisma.systemSetting.upsert({
    where: { key: "notifications.certificateExpiryDays" },
    update: { valueJson: "30" },
    create: { key: "notifications.certificateExpiryDays", valueJson: "30" },
  });
  invalidateSettingsCache();
});

afterAll(async () => {
  if (!dbUp) return;
  await prisma.systemSetting.deleteMany({ where: { key: "notifications.certificateExpiryDays" } }).catch(() => {});
  invalidateSettingsCache();
  await cleanup();
});

async function cleanup() {
  await prisma.notification.deleteMany({ where: { userId: owner } }).catch(() => {});
  await prisma.document.deleteMany({ where: { title: { startsWith: P } } }).catch(() => {});
  await prisma.user.deleteMany({ where: { id: owner } }).catch(() => {});
}

describe("DOM-04 — certificateExpiryDays caps the reminder lead", () => {
  it("skips a document beyond the configured lead, reminds one within it", async () => {
    if (!dbUp) return;
    await generateCertificateReminders(null);
    const far = await prisma.document.findUnique({ where: { id: farDoc } });
    const near = await prisma.document.findUnique({ where: { id: nearDoc } });
    // 100 days out > 30-day lead → no reminder ledger written (stays null).
    expect(far?.remindersSentJson).toBeNull();
    // 20 days out ≤ 30-day lead → reminded (ledger records the 30-day threshold).
    expect(near?.remindersSentJson).not.toBeNull();
    expect(JSON.parse(near?.remindersSentJson ?? "[]")).toContain(30);
  });
});
