import type { Metadata } from "next";
import { MessagesSquare } from "lucide-react";
import { getServerI18n } from "@/lib/server-i18n";

export const metadata: Metadata = { title: "Discussions" };

export default async function DiscussionsIndexPage() {
  const { t } = await getServerI18n();
  return (
    <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-soft text-accent"><MessagesSquare className="h-6 w-6" /></div>
      <h2 className="text-[15px] font-semibold text-ink">{t("disc.title")}</h2>
      <p className="mt-1 max-w-sm text-[13px] text-ink-3">{t("disc.subtitle")}</p>
    </div>
  );
}
