"use client";

import { useEffect } from "react";
import { markReadAction } from "@/app/actions/discussions";

/** Marks the channel read when opened (fire-and-forget). */
export function MarkRead({ channelId }: { channelId: string }) {
  useEffect(() => {
    markReadAction(channelId).catch(() => {});
  }, [channelId]);
  return null;
}
