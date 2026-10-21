import type { BmrChoice } from "@/lib/domain/nutrition";

/**
 * Textos da fonte da TMB no formulário de metas (sem I/O): o título curto ("TMB: balança (19/10)"
 * ou "TMB: fórmula") e a explicação, inclusive quando a escolha caiu na fórmula.
 */

const dayMonth = (day: string) => `${day.slice(8, 10)}/${day.slice(5, 7)}`;
const full = (day: string) => `${day.slice(8, 10)}/${day.slice(5, 7)}/${day.slice(0, 4)}`;

const FORMULA = "a fórmula de Mifflin-St Jeor";

export function bmrSourceText(choice: BmrChoice): { title: string; detail: string } {
  if (choice.source === "scale") {
    return {
      title: choice.date ? `TMB: balança (${dayMonth(choice.date)})` : "TMB: balança",
      detail: choice.date ? `Metabolismo basal medido pela balança em ${full(choice.date)}.` : "Metabolismo basal medido pela balança.",
    };
  }
  const detail: Record<Exclude<BmrChoice["reason"], "scale">, string> = {
    formula_chosen: `Fonte escolhida: ${FORMULA}.`,
    no_measurement: `Sem medição da balança com metabolismo basal: usa ${FORMULA}.`,
    stale: `A última TMB medida (${choice.date ? full(choice.date) : "—"}) tem mais de 30 dias: usa ${FORMULA}.`,
    fallback: `Você escolheu a balança, mas não há medição com metabolismo basal: usa ${FORMULA}.`,
  };
  return { title: "TMB: fórmula", detail: detail[choice.reason as Exclude<BmrChoice["reason"], "scale">] };
}
