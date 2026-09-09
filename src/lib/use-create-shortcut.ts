"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * Cmd/Ctrl-K "Create" support (§29). The command palette deep-links to a module's
 * list page with `?new=1`; a create-drawer component calls this hook so it opens
 * automatically and then strips the param from the URL (so a refresh doesn't
 * re-open it). One shared hook keeps the behavior identical across every module.
 */
export function useCreateShortcut(open: () => void) {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const fired = useRef(false);

  useEffect(() => {
    if (params.get("new") === "1" && !fired.current) {
      fired.current = true;
      open();
      const next = new URLSearchParams(params.toString());
      next.delete("new");
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, pathname]);
}
