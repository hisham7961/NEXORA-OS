import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { getServerI18n } from "@/lib/server-i18n";

/** Server-rendered pagination bar; preserves existing query params. Localized. */
export async function Pagination({
  page,
  pageSize,
  total,
  params = {},
}: {
  page: number;
  pageSize: number;
  total: number;
  params?: Record<string, string | undefined>;
}) {
  const { t } = await getServerI18n();
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  const href = (p: number) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
    sp.set("page", String(p));
    return `?${sp.toString()}`;
  };

  const linkCls = "inline-flex h-8 w-8 items-center justify-center rounded-md border border-line-strong text-ink-2 hover:bg-surface-2 transition-colors";
  const disabledCls = "pointer-events-none opacity-40";

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-t border-line">
      <p className="text-xs text-ink-3 tabular">
        {from}–{to} {t("common.of")} {total}
      </p>
      <div className="flex items-center gap-1.5">
        <span className="me-1 text-xs text-ink-3 tabular">{t("common.page")} {page} / {totalPages}</span>
        <Link href={href(Math.max(1, page - 1))} className={cn(linkCls, page <= 1 && disabledCls)} aria-label={t("common.previous")}>
          <ChevronLeft className="h-4 w-4 flip-x" />
        </Link>
        <Link href={href(Math.min(totalPages, page + 1))} className={cn(linkCls, page >= totalPages && disabledCls)} aria-label={t("common.next")}>
          <ChevronRight className="h-4 w-4 flip-x" />
        </Link>
      </div>
    </div>
  );
}
