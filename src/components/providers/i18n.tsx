"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { createTranslator, dir, type Locale, type Translator } from "@/i18n";

interface I18nContextValue {
  locale: Locale;
  t: Translator;
  dir: "rtl" | "ltr";
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  const value = useMemo<I18nContextValue>(
    () => ({ locale, t: createTranslator(locale), dir: dir(locale) }),
    [locale],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
