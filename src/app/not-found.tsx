import Link from "next/link";
import { Compass } from "lucide-react";
import { getServerI18n } from "@/lib/server-i18n";

export default async function NotFound() {
  const { t } = await getServerI18n();
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-bg px-4 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-surface-2 text-ink-3">
        <Compass className="h-5 w-5" />
      </div>
      <h1 className="text-lg font-semibold text-ink">{t("errors.notFoundTitle")}</h1>
      <p className="mt-1.5 max-w-sm text-[13px] text-ink-2">{t("errors.notFoundBody")}</p>
      <Link
        href="/"
        className="mt-5 inline-flex h-9 items-center rounded-md bg-accent px-4 text-[13px] font-medium text-on-accent hover:bg-accent-hover"
      >
        {t("errors.returnHome")}
      </Link>
    </div>
  );
}
