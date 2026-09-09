import { Avatar } from "@/components/ui";
import { cn } from "@/lib/utils";

/** Small relational chips that make entity relationships visible (§44). */

export function BrandChip({ name, color, className }: { name: string; color?: string | null; className?: string }) {
  if (!name || name === "—") return <span className="text-ink-3">—</span>;
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[13px] text-ink", className)}>
      <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: color ?? "var(--accent)" }} />
      {name}
    </span>
  );
}

/** Emoji flag from an ISO-3166 alpha-2 code (KW → 🇰🇼). */
function flag(iso2?: string | null): string {
  if (!iso2 || iso2.length !== 2) return "";
  const base = 0x1f1e6;
  return String.fromCodePoint(...[...iso2.toUpperCase()].map((c) => base + c.charCodeAt(0) - 65));
}

export function CountryChip({ name, iso2, className }: { name: string; iso2?: string | null; className?: string }) {
  if (!name || name === "—") return <span className="text-ink-3">—</span>;
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[13px] text-ink", className)}>
      <span aria-hidden>{flag(iso2)}</span>
      {name}
    </span>
  );
}

export function UserChip({ name, color, className }: { name: string; color?: string | null; className?: string }) {
  if (!name || name === "—") return <span className="text-ink-3">—</span>;
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[13px] text-ink", className)}>
      <Avatar name={name} color={color} size={20} />
      {name}
    </span>
  );
}
