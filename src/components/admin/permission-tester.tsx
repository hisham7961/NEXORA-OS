"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Select } from "@/components/ui";
import { useI18n } from "@/components/providers";

/** User picker for the Permission Tester — updates ?user= so the server recomputes. */
export function TesterUserPicker({
  users,
  current,
}: {
  users: { id: string; name: string; email: string }[];
  current?: string;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function select(id: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (id) params.set("user", id);
    else params.delete("user");
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <Select value={current ?? ""} onChange={(e) => select(e.target.value)} className="w-72" aria-label={t("pt.selectUserAria")}>
      <option value="">{t("pt.selectUser")}</option>
      {users.map((u) => (
        <option key={u.id} value={u.id}>
          {u.name} — {u.email}
        </option>
      ))}
    </Select>
  );
}
