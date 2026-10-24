import {
  type GoalMetric,
  goalProgress,
  latestValue,
  METRIC,
  metricSeries,
  projectGoal,
  type GoalLike,
  type MeasurementLike,
  type MetricDef,
  type Point,
  type Projection,
} from "@/features/composition/domain/composition";

/**
 * Metas de composição para a tela (sem I/O): progresso, projeção e os textos. As contas ficam em
 * `src/features/composition/domain/composition.ts`.
 */

/** "2026-10-19" → "19/10/2026". */
export function formatDateBR(day: string): string {
  const [y, m, d] = day.split("-");
  return `${d}/${m}/${y}`;
}

/** "2026-10-19" → "19/10". */
export function formatDayMonth(day: string): string {
  const [, m, d] = day.split("-");
  return `${d}/${m}`;
}

/** Motivo de "sem projeção", em texto. */
export const NO_PROJECTION_TEXT: Record<Extract<Projection, { none: string }>["none"], string> = {
  insufficient: "poucas medições (são precisas 3)",
  away: "a tendência vai na direção contrária ao alvo",
  flat: "a tendência está estável",
  reached: "a meta já foi atingida",
};

/** "Deve chegar em 12/01/2027" ou "Sem projeção: <motivo>". */
export function projectionText(p: Projection): string {
  return "date" in p ? `Deve chegar em ${formatDateBR(p.date)}` : `Sem projeção: ${NO_PROJECTION_TEXT[p.none]}`;
}

export type GoalView = {
  def: MetricDef;
  start: Point;
  /** Último valor medido da métrica; sem medição, a própria partida. */
  current: Point;
  target: number;
  /** Fração concluída, 0–1. */
  progress: number;
  /** "62% concluído". */
  progressText: string;
  projection: Projection;
  projectionText: string;
  /** A projeção cai depois da data-alvo. */
  late: boolean;
};

/** Progresso (partida → atual → alvo) e projeção pela tendência de todo o histórico da métrica. */
export function goalView(goal: GoalLike & { target_date: string | null }, ms: readonly MeasurementLike[]): GoalView {
  const def = METRIC[goal.metric];
  const start = { day: goal.start_day, value: goal.start_value };
  const current = latestValue(ms, goal.metric) ?? start;
  const progress = goalProgress(goal.start_value, current.value, goal.target);
  const projection = projectGoal(metricSeries(ms, goal.metric), goal.target, goal.start_value);
  const late = "date" in projection && goal.target_date !== null && projection.date > goal.target_date;
  return {
    def,
    start,
    current,
    target: goal.target,
    progress,
    progressText: `${Math.floor(progress * 100)}% concluído`,
    projection,
    projectionText: projectionText(projection),
    late,
  };
}

const fmtRange = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });

/** Erros do formulário de meta (vazio = válido). */
export function goalFormErrors(
  metric: GoalMetric | "",
  target: number | null,
  start: number | null,
  targetDate: string,
  today: string,
): string[] {
  if (!metric) return ["Escolha a métrica."];
  const def = METRIC[metric];
  const errors: string[] = [];
  if (start === null) errors.push(`Ainda não há medição de ${def.label.toLowerCase()}.`);
  if (target === null) errors.push("Informe o alvo.");
  else if (!Number.isFinite(target) || target < def.min || target > def.max) {
    errors.push(`Alvo entre ${fmtRange(def.min)} e ${fmtRange(def.max)}${def.unit ? ` ${def.unit}` : ""}.`);
  } else if (start !== null && target === start) errors.push("O alvo precisa ser diferente do valor de partida.");
  if (targetDate && targetDate < today) errors.push("A data-alvo não pode estar no passado.");
  return errors;
}

