"use client";

import { CircleAlert } from "lucide-react";
import { optionMacros, roundMacros, type Macros, type PlanItem } from "@/features/nutrition/domain/nutrition";
import { cn } from "@/lib/utils";
import { useFoodsById } from "../hooks";

const one = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
const int = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });

/** "477 kcal · P 30,5 g · C 39,9 g · G 20,5 g" (valores arredondados para exibir). */
export function formatMacros(m: Macros): string {
  const r = roundMacros(m);
  return `${int.format(r.kcal)} kcal · P ${one.format(r.protein)} g · C ${one.format(r.carbs)} g · G ${one.format(r.fat)} g`;
}

export const unresolvedLabel = (n: number) => (n === 1 ? "1 item sem valor" : `${n} itens sem valor`);

/**
 * Kcal e macros de um conjunto de itens, com o aviso de itens sem valor (ícone + texto).
 * As letras P/C/G têm o nome completo para leitores de tela. Só `span`: cabe dentro de botão.
 */
export function MacroSummary({
  total,
  unresolved,
  className,
  testId = "option-macros",
}: {
  total: Macros;
  unresolved: number;
  className?: string;
  testId?: string;
}) {
  const r = roundMacros(total);
  return (
    <span className={cn("flex flex-wrap items-center gap-x-3 gap-y-1 text-xs", className)} data-testid={testId}>
      <span className="num text-muted-foreground">
        <span className="font-semibold text-foreground">{int.format(r.kcal)} kcal</span>
        <span aria-hidden> · </span>
        <abbr title="proteína" className="no-underline">P</abbr> {one.format(r.protein)} g
        <span aria-hidden> · </span>
        <abbr title="carboidrato" className="no-underline">C</abbr> {one.format(r.carbs)} g
        <span aria-hidden> · </span>
        <abbr title="gordura" className="no-underline">G</abbr> {one.format(r.fat)} g
      </span>
      {unresolved > 0 && (
        <span className="flex items-center gap-1 font-medium text-highlight-text" data-testid="unresolved-items">
          <CircleAlert aria-hidden className="size-3.5 shrink-0" />
          {unresolvedLabel(unresolved)}
        </span>
      )}
    </span>
  );
}

/** Macros de uma opção do plano, calculados com os alimentos em cache. Nada enquanto carregam. */
export function OptionMacros({ items, className }: { items: readonly PlanItem[]; className?: string }) {
  const foods = useFoodsById();
  if (!foods || items.length === 0) return null;
  const { total, unresolved } = optionMacros(items, foods);
  return <MacroSummary total={total} unresolved={unresolved} className={className} />;
}
