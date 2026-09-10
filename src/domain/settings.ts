import type { Principal } from "@/lib/permissions/engine";
import { prisma } from "@/lib/db";
import { assertCan, audit, type ActorContext } from "@/domain/mutation";
import { ServiceError } from "@/lib/api/handler";
import { SETTING_DEFS, SETTING_BY_KEY, SETTING_CATEGORIES, coerceSetting, decodeSetting, type SettingDef } from "@/lib/settings/registry";

/**
 * System Settings administration (§Phase4-6/7/8). Reads/writes go through the typed
 * registry so every setting is validated, permission-gated and audited. Secrets are
 * environment-managed and reported as Configured / Not configured, never revealed.
 */

export interface SettingView {
  key: string; category: string; label: string; description: string; type: string;
  value: string | number | boolean | null; options?: { value: string; label: string }[];
  min?: number; max?: number; restartRequired?: boolean; secretConfigured?: boolean; canEdit: boolean;
}

export async function getSettingsForAdmin(principal: Principal): Promise<{ categories: readonly string[]; settings: SettingView[] }> {
  assertCan(principal, "settings.view");
  const rows = await prisma.systemSetting.findMany();
  const byKey = new Map(rows.map((r) => [r.key, r.valueJson]));
  const settings: SettingView[] = SETTING_DEFS.map((def) => {
    if (def.type === "secret") {
      const configured = !!(def.envVar && process.env[def.envVar]);
      return { key: def.key, category: def.category, label: def.label, description: def.description, type: def.type, value: null, secretConfigured: configured, canEdit: false };
    }
    return {
      key: def.key, category: def.category, label: def.label, description: def.description, type: def.type,
      value: decodeSetting(def, byKey.get(def.key)), options: def.options, min: def.min, max: def.max,
      restartRequired: def.restartRequired, canEdit: true,
    };
  });
  return { categories: SETTING_CATEGORIES, settings };
}

export async function updateSetting(ctx: ActorContext, key: string, raw: unknown) {
  const def = SETTING_BY_KEY.get(key) as SettingDef | undefined;
  if (!def) throw new ServiceError("unknown_setting", "Unknown setting.", 404);
  assertCan(ctx.principal, def.permission);
  let valueJson: string;
  try { valueJson = coerceSetting(def, raw); } catch (e) { throw new ServiceError("invalid_value", (e as Error).message, 422); }
  const existing = await prisma.systemSetting.findUnique({ where: { key } });
  const saved = await prisma.systemSetting.upsert({
    where: { key },
    create: { key, valueJson, category: def.category.toLowerCase(), updatedById: ctx.principal.userId },
    update: { valueJson, updatedById: ctx.principal.userId },
  });
  await audit(ctx, { action: "setting.updated", entityType: "SystemSetting", entityId: saved.id, summary: `${key} → ${valueJson}`, oldValues: existing ? { valueJson: existing.valueJson } : null, newValues: { valueJson } });
  invalidateSettingsCache();
  return saved;
}

// ---------------------------------------------------------------------------
// Runtime accessor (cached) — consumers read effective values without importing UI.
// ---------------------------------------------------------------------------
let cache: { at: number; values: Map<string, string> } | null = null;
const TTL_MS = 30_000;

async function loadValues(): Promise<Map<string, string>> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.values;
  const rows = await prisma.systemSetting.findMany();
  const values = new Map(rows.map((r) => [r.key, r.valueJson]));
  cache = { at: Date.now(), values };
  return values;
}

/** Effective value of a setting (stored, else registry default). For non-secret keys. */
export async function getSettingValue<T = string | number | boolean>(key: string): Promise<T> {
  const def = SETTING_BY_KEY.get(key);
  if (!def) throw new Error(`Unknown setting ${key}`);
  const values = await loadValues();
  return decodeSetting(def, values.get(key)) as T;
}

/** Invalidate the runtime cache (called after an update). */
export function invalidateSettingsCache() { cache = null; }
