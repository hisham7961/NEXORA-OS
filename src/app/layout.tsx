import type { Metadata, Viewport } from "next";
import { cookies, headers } from "next/headers";
import { Inter } from "next/font/google";
import { Providers, ThemeScript } from "@/components/providers";
import { dir, isLocale, type Locale } from "@/i18n";
import { env } from "@/lib/env";
import "./globals.css";

// The design system names Inter in --font-sans; load it for real (audit UX-01).
// `display: swap` keeps first paint fast; the CSS stack still falls back for Arabic glyphs.
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

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
  // The middleware sets a per-request CSP nonce (x-nonce). The inline no-FOUC theme
  // script must carry it or `strict-dynamic` blocks it on every route (audit RT-01).
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <html lang={locale} dir={dir(locale)} className={inter.variable} suppressHydrationWarning>
      <head>
        <ThemeScript nonce={nonce} />
      </head>
      <body>
        <Providers locale={locale}>{children}</Providers>
      </body>
    </html>
  );
}
