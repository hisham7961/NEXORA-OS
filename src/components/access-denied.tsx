import { ShieldAlert } from "lucide-react";
import { createTranslator, type Locale } from "@/i18n";

export function AccessDenied({ locale }: { locale: Locale }) {
  const t = createTranslator(locale);
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-critical-soft text-critical">
        <ShieldAlert className="h-5 w-5" />
      </div>
      <h1 className="text-base font-semibold text-ink">{t("common.deniedTitle")}</h1>
      <p className="mt-1.5 max-w-sm text-[13px] text-ink-2">{t("common.deniedBody")}</p>
    </div>
  );
}
