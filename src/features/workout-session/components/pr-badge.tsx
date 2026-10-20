import { Trophy } from "lucide-react";
import type { PrKind } from "@/lib/domain/workout";
import { cn } from "@/lib/utils";

export const PR_LABELS: Record<PrKind, string> = {
  weight: "carga",
  volume: "volume",
  e1rm: "1RM",
  duration: "duração",
  distance: "distância",
};

/** Selo de recorde: troféu + texto (não depende só da cor). */
export function PrBadge({ kinds, className }: { kinds: readonly PrKind[]; className?: string }) {
  if (kinds.length === 0) return null;
  return (
    <span
      data-testid="pr-badge"
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-highlight/50 bg-highlight/15 px-2 py-0.5 text-xs font-semibold text-highlight-text",
        className,
      )}
    >
      <Trophy aria-hidden className="size-3.5" />
      PR · {kinds.map((k) => PR_LABELS[k]).join(", ")}
    </span>
  );
}
