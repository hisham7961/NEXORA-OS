import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import type { Principal } from "@/lib/permissions/engine";
import { canAnywhere } from "@/lib/permissions/engine";
import { seal, open } from "@/lib/auth/secretbox";
import { generateTotpSecret, verifyTotp, otpauthUri } from "@/lib/auth/totp";
import { audit, type ActorContext } from "@/domain/mutation";
import { ServiceError } from "@/lib/api/handler";

/**
 * Multi-factor authentication (§26-27). TOTP-based, using an authenticator app.
 * Enrollment is two-step: a secret is generated and shown as a QR/otpauth URI but
 * only becomes active once the user proves they can produce a valid code. Backup
 * recovery codes (hashed, single-use) let a user in if they lose their device. The
 * TOTP secret is sealed at rest. Two org policies (settings) can make MFA mandatory
 * for admins and/or finance users.
 */

const RECOVERY_COUNT = 10;

function hashRecovery(code: string): string {
  return createHash("sha256").update(`${code}:${env.sessionSecret}`).digest("hex");
}
function newRecoveryCode(): string {
  // 10 hex chars, grouped for readability (e.g. "a1b2c-3d4e5").
  const raw = randomBytes(5).toString("hex");
  return `${raw.slice(0, 5)}-${raw.slice(5)}`;
}

export interface MfaStatus { enabled: boolean; enrolledAt: Date | null; recoveryRemaining: number }

export async function mfaStatus(userId: string): Promise<MfaStatus> {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { mfaEnabledAt: true, mfaRecoveryJson: true } });
  const codes = u?.mfaRecoveryJson ? (JSON.parse(u.mfaRecoveryJson) as string[]) : [];
  return { enabled: !!u?.mfaEnabledAt, enrolledAt: u?.mfaEnabledAt ?? null, recoveryRemaining: codes.length };
}

/** Step 1: generate (or regenerate) a pending secret and return it for QR/manual entry. */
export async function beginMfaEnrollment(ctx: ActorContext): Promise<{ secret: string; otpauthUri: string }> {
  const user = await prisma.user.findUnique({ where: { id: ctx.principal.userId }, select: { email: true, mfaEnabledAt: true } });
  if (!user) throw new ServiceError("not_found", "User not found", 404);
  if (user.mfaEnabledAt) throw new ServiceError("mfa_already_enabled", "MFA is already enabled. Disable it first to re-enroll.", 409);
  const secret = generateTotpSecret();
  await prisma.user.update({ where: { id: ctx.principal.userId }, data: { mfaSecret: seal(secret), mfaEnabledAt: null } });
  return { secret, otpauthUri: otpauthUri(secret, { issuer: env.appName, account: user.email }) };
}

/** Step 2: confirm the code, activate MFA, and return one-time recovery codes. */
export async function confirmMfaEnrollment(ctx: ActorContext, code: string): Promise<{ recoveryCodes: string[] }> {
  const user = await prisma.user.findUnique({ where: { id: ctx.principal.userId }, select: { mfaSecret: true, mfaEnabledAt: true } });
  if (!user?.mfaSecret) throw new ServiceError("mfa_not_started", "Start MFA setup first.", 409);
  if (user.mfaEnabledAt) throw new ServiceError("mfa_already_enabled", "MFA is already enabled.", 409);
  const secret = open(user.mfaSecret);
  if (!secret || !verifyTotp(secret, code)) throw new ServiceError("mfa_bad_code", "That code is incorrect or expired.", 422);

  const recoveryCodes = Array.from({ length: RECOVERY_COUNT }, newRecoveryCode);
  await prisma.user.update({
    where: { id: ctx.principal.userId },
    data: { mfaEnabledAt: new Date(), mfaRecoveryJson: JSON.stringify(recoveryCodes.map(hashRecovery)) },
  });
  await audit(ctx, { action: "mfa.enabled", entityType: "User", entityId: ctx.principal.userId, summary: "Enabled two-factor authentication" });
  return { recoveryCodes };
}

/** Disable MFA — requires a current TOTP or an unused recovery code. */
export async function disableMfa(ctx: ActorContext, code: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: ctx.principal.userId }, select: { mfaSecret: true, mfaEnabledAt: true, mfaRecoveryJson: true } });
  if (!user?.mfaEnabledAt) throw new ServiceError("mfa_not_enabled", "MFA is not enabled.", 409);
  const ok = await verifyAnyFactor(user, code);
  if (!ok.valid) throw new ServiceError("mfa_bad_code", "That code is incorrect or expired.", 422);
  await prisma.user.update({ where: { id: ctx.principal.userId }, data: { mfaSecret: null, mfaEnabledAt: null, mfaRecoveryJson: null } });
  await audit(ctx, { action: "mfa.disabled", entityType: "User", entityId: ctx.principal.userId, summary: "Disabled two-factor authentication" });
}

interface FactorFields { mfaSecret: string | null; mfaRecoveryJson: string | null }
/** Check a code against the TOTP secret, then against unused recovery codes. */
async function verifyAnyFactor(u: FactorFields, code: string): Promise<{ valid: boolean; usedRecovery: boolean; remaining: string[] }> {
  const clean = code.trim();
  const secret = open(u.mfaSecret);
  if (secret && verifyTotp(secret, clean)) return { valid: true, usedRecovery: false, remaining: [] };
  const codes: string[] = u.mfaRecoveryJson ? JSON.parse(u.mfaRecoveryJson) : [];
  const h = hashRecovery(clean.toLowerCase());
  if (codes.includes(h)) return { valid: true, usedRecovery: true, remaining: codes.filter((c) => c !== h) };
  return { valid: false, usedRecovery: false, remaining: codes };
}

/**
 * Login-time verification. Verifies a TOTP or consumes a single-use recovery code
 * (persisting the reduced set). Returns whether the second factor is satisfied.
 */
export async function verifyMfaForLogin(userId: string, code: string): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { mfaSecret: true, mfaRecoveryJson: true, mfaEnabledAt: true } });
  if (!user?.mfaEnabledAt) return true; // MFA not enabled → nothing to verify
  const res = await verifyAnyFactor(user, code);
  if (!res.valid) return false;
  if (res.usedRecovery) {
    await prisma.user.update({ where: { id: userId }, data: { mfaRecoveryJson: JSON.stringify(res.remaining) } }).catch(() => {});
  }
  return true;
}

export async function isMfaEnabled(userId: string): Promise<boolean> {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { mfaEnabledAt: true } });
  return !!u?.mfaEnabledAt;
}

/**
 * Whether org policy requires this principal to use MFA. Two independent settings
 * flags cover admins and finance users; a Super Admin counts as an admin.
 */
export async function mfaRequiredFor(principal: Principal): Promise<boolean> {
  const { getSettingValue } = await import("@/domain/settings");
  const [adminsFlag, financeFlag] = await Promise.all([
    getSettingValue<boolean>("security.mfaRequiredForAdmins").catch(() => false),
    getSettingValue<boolean>("security.mfaRequiredForFinance").catch(() => false),
  ]);
  const isAdmin = principal.isSuperAdmin || canAnywhere(principal, "settings.manage") || canAnywhere(principal, "permissions.manage");
  const isFinance = canAnywhere(principal, "accounting.view") || canAnywhere(principal, "finance.view") || canAnywhere(principal, "expenses.view");
  return (!!adminsFlag && isAdmin) || (!!financeFlag && isFinance);
}
