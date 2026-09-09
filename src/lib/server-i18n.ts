import { cookies } from "next/headers";
import { createTranslator, dir, isLocale, type Locale } from "@/i18n";
import { env } from "@/lib/env";

/** Resolve the request locale (cookie → default) for server components. */
export async function getLocale(): Promise<Locale> {
  const store = await cookies();
  const cookieLocale = store.get("nexora_locale")?.value;
  return isLocale(cookieLocale) ? cookieLocale : env.defaultLocale;
}

export async function getServerI18n() {
  const locale = await getLocale();
  return { locale, dir: dir(locale), t: createTranslator(locale) };
}
