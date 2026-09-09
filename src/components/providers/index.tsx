"use client";

import type { ReactNode } from "react";
import type { Locale } from "@/i18n";
import { I18nProvider } from "./i18n";
import { ThemeProvider } from "./theme";

export function Providers({ locale, children }: { locale: Locale; children: ReactNode }) {
  return (
    <ThemeProvider>
      <I18nProvider locale={locale}>{children}</I18nProvider>
    </ThemeProvider>
  );
}

export { useTheme, ThemeScript } from "./theme";
export { useI18n } from "./i18n";
