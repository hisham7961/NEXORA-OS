import { describe, it, expect } from "vitest";
import { dictionaries } from "@/i18n/dictionaries";

/**
 * EN ↔ AR dictionary parity (§6/§77). Both locales must carry exactly the same set
 * of keys — a key present in one but not the other is a release blocker, because a
 * missing Arabic key would silently fall back to English in production. CI fails on
 * any mismatch.
 */
describe("i18n dictionary parity", () => {
  const en = Object.keys(dictionaries.en);
  const ar = Object.keys(dictionaries.ar);
  const enSet = new Set(en);
  const arSet = new Set(ar);

  it("every English key has an Arabic translation", () => {
    const missing = en.filter((k) => !arSet.has(k));
    expect(missing, `Missing in ar: ${missing.join(", ")}`).toEqual([]);
  });

  it("every Arabic key has an English counterpart (no orphans)", () => {
    const orphan = ar.filter((k) => !enSet.has(k));
    expect(orphan, `Orphan ar keys: ${orphan.join(", ")}`).toEqual([]);
  });

  it("no key has an empty translation in either locale", () => {
    const emptyEn = en.filter((k) => !String((dictionaries.en as Record<string, string>)[k]).trim());
    const emptyAr = ar.filter((k) => !String((dictionaries.ar as Record<string, string>)[k]).trim());
    expect(emptyEn, `Empty en values: ${emptyEn.join(", ")}`).toEqual([]);
    expect(emptyAr, `Empty ar values: ${emptyAr.join(", ")}`).toEqual([]);
  });

  it("Arabic is not a verbatim copy of English for a sizable share of keys", () => {
    // Guards against a placeholder ar dictionary that just mirrors en. Technical
    // tokens (codes, units) legitimately match, so we only require that MOST keys differ.
    const identical = en.filter((k) => (dictionaries.en as Record<string, string>)[k] === (dictionaries.ar as Record<string, string>)[k]);
    expect(identical.length / en.length).toBeLessThan(0.35);
  });
});
