import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { Providers, ThemeScript } from "@/components/providers";
import { dir, isLocale, type Locale } from "@/i18n";
import { env } from "@/lib/env";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "NEXORA OS",
    template: "%s · NEXORA OS",
  },
  description: "The central operating system for a multi-company, multi-brand cosmetics group.", // i18n-ignore: SEO metadata, not in-app UI
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f5f2" },
    { media: "(prefers-color-scheme: dark)", color: "#131211" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const store = await cookies();
  const cookieLocale = store.get("nexora_locale")?.value;
  const locale: Locale = isLocale(cookieLocale) ? cookieLocale : env.defaultLocale;

  return (
    <html lang={locale} dir={dir(locale)} suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body>
        <Providers locale={locale}>{children}</Providers>
      </body>
    </html>
  );
}
