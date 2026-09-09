import type { Locale } from "@/i18n";

/** Locale-aware formatting (§40). Dates are stored as UTC and presented locally. */

const LOCALE_TAG: Record<Locale, string> = { en: "en-GB", ar: "ar-KW" };

function tag(locale: Locale): string {
  return LOCALE_TAG[locale] ?? "en-GB";
}

export type Numeric = number | string | { toString(): string } | null | undefined;

function toNumber(value: Numeric): number {
  if (value == null) return 0;
  if (typeof value === "number") return value;
  const n = Number(typeof value === "string" ? value : value.toString());
  return Number.isFinite(n) ? n : 0;
}

export function formatDateShort(date: Date | string | null | undefined, locale: Locale = "en"): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat(tag(locale), { day: "2-digit", month: "short" }).format(d);
}

export function formatDate(date: Date | string | null | undefined, locale: Locale = "en"): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat(tag(locale), { day: "2-digit", month: "short", year: "numeric" }).format(d);
}

export function formatDateTime(date: Date | string | null | undefined, locale: Locale = "en"): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat(tag(locale), {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  }).format(d);
}

export function formatNumber(value: Numeric, locale: Locale = "en"): string {
  return new Intl.NumberFormat(tag(locale)).format(toNumber(value));
}

export function formatCurrency(value: Numeric, currency = "KWD", locale: Locale = "en"): string {
  const digits = currency === "KWD" || currency === "BHD" || currency === "OMR" ? 3 : 2;
  return new Intl.NumberFormat(tag(locale), {
    style: "currency",
    currency,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(toNumber(value));
}

export function formatCompact(value: Numeric, locale: Locale = "en"): string {
  return new Intl.NumberFormat(tag(locale), { notation: "compact", maximumFractionDigits: 1 }).format(toNumber(value));
}

/** Relative time like "in 3 days" / "2 days ago". */
export function formatRelative(date: Date | string | null | undefined, locale: Locale = "en"): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  const diffDays = Math.round((d.getTime() - Date.now()) / 86_400_000);
  const rtf = new Intl.RelativeTimeFormat(tag(locale), { numeric: "auto" });
  if (Math.abs(diffDays) < 1) return rtf.format(0, "day");
  return rtf.format(diffDays, "day");
}
