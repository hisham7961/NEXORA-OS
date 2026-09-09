import { dictionaries, type Locale, type TranslationKey } from "./dictionaries";

export type { Locale, TranslationKey };
export { dictionaries };

export const LOCALES: Locale[] = ["en", "ar"];

export function isLocale(value: string | null | undefined): value is Locale {
  return value === "en" || value === "ar";
}

export function dir(locale: Locale): "rtl" | "ltr" {
  return locale === "ar" ? "rtl" : "ltr";
}

/** A bound translator. Falls back: locale → en → key. */
export type Translator = (key: TranslationKey | string, vars?: Record<string, string | number>) => string;

export function createTranslator(locale: Locale): Translator {
  const dict = dictionaries[locale] as Record<string, string>;
  const fallback = dictionaries.en as Record<string, string>;
  return (key, vars) => {
    let value = dict[key] ?? fallback[key] ?? String(key);
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        value = value.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
      }
    }
    return value;
  };
}
