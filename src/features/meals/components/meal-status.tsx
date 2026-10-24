import { CircleCheck, CircleDashed, CircleSlash2 } from "lucide-react";
import type { MealStatus } from "@/features/meals/domain/meals";
import { cn } from "@/lib/utils";

const STATUS = {
  pending: { icon: CircleDashed, label: "Pendente", className: "text-muted-foreground" },
  done: { icon: CircleCheck, label: "Feita", className: "text-primary-text" },
  off_plan: { icon: CircleSlash2, label: "Fora do plano", className: "text-highlight-text" },
} as const;

export const statusLabel = (status: MealStatus) => STATUS[status].label;

/** Estado da refeição com ícone + texto (nunca só a cor). */
export function MealStatusBadge({ status, detail }: { status: MealStatus; detail?: string | null }) {
  const { icon: Icon, label, className } = STATUS[status];
  return (
    <span className={cn("flex min-w-0 items-center gap-1.5 text-sm font-medium", className)} data-status={status}>
      <Icon aria-hidden className="size-4 shrink-0" />
      <span className="shrink-0">{label}</span>
      {detail && <span className="min-w-0 truncate font-normal text-muted-foreground">· {detail}</span>}
    </span>
  );
}
