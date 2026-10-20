/**
 * Composição corporal (v3): catálogo das 17 métricas da balança, validação, variações, série do
 * gráfico, progresso e projeção de meta. Sem I/O.
 *
 * As faixas de `METRICS` são as mesmas dos checks de `body_measurements`
 * (migration `…_v3_composition.sql`): mudou uma, mude a outra.
 */

import { dayInSaoPaulo } from "./day";
import { addDays, dayToTime } from "./stats";

export type MetricKey =
  | "weight_kg"
  | "bmi"
  | "body_fat_pct"
  | "fat_mass_kg"
  | "skeletal_muscle_pct"
  | "skeletal_muscle_kg"
  | "muscle_rate_pct"
  | "muscle_mass_kg"
  | "visceral_fat"
  | "water_pct"
  | "water_kg"
  | "bmr_kcal"
  | "obesity_pct"
  | "bone_kg"
  | "protein_pct"
  | "lean_mass_kg"
  | "metabolic_age";

export type MetricDef = {
  key: MetricKey;
  label: string;
  /** Unidade exibida ("" quando a métrica é um índice ou nível). */
  unit: string;
  /** Faixa válida, inclusiva. */
  min: number;
  max: number;
  /** Direção desejada: gordura caindo é bom, músculo caindo é ruim; neutra sem julgamento. */
  better: "up" | "down" | "neutral";
  principal: boolean;
  /** Só aceita inteiros (idade metabólica). */
  integer?: boolean;
};

/** Ordem do catálogo: a do formulário e do detalhe da medição. */
export const METRICS: readonly MetricDef[] = [
  { key: "weight_kg", label: "Peso", unit: "kg", min: 20, max: 300, better: "neutral", principal: true },
  { key: "body_fat_pct", label: "Gordura corporal", unit: "%", min: 2, max: 70, better: "down", principal: true },
  { key: "skeletal_muscle_kg", label: "Massa muscular esquelética", unit: "kg", min: 5, max: 120, better: "up", principal: true },
  { key: "visceral_fat", label: "Gordura visceral", unit: "", min: 1, max: 60, better: "down", principal: true },
  { key: "lean_mass_kg", label: "Massa magra", unit: "kg", min: 15, max: 200, better: "up", principal: true },
  { key: "bmi", label: "IMC", unit: "", min: 10, max: 70, better: "neutral", principal: false },
  { key: "fat_mass_kg", label: "Massa de gordura", unit: "kg", min: 0.5, max: 200, better: "down", principal: false },
  { key: "skeletal_muscle_pct", label: "Músculo esquelético", unit: "%", min: 10, max: 75, better: "up", principal: false },
  { key: "muscle_rate_pct", label: "Taxa muscular", unit: "%", min: 20, max: 98, better: "up", principal: false },
  { key: "muscle_mass_kg", label: "Massa muscular", unit: "kg", min: 10, max: 200, better: "up", principal: false },
  { key: "water_pct", label: "Água corporal", unit: "%", min: 20, max: 80, better: "neutral", principal: false },
  { key: "water_kg", label: "Massa de água", unit: "kg", min: 10, max: 150, better: "neutral", principal: false },
  { key: "bmr_kcal", label: "Metabolismo basal", unit: "kcal", min: 500, max: 5000, better: "up", principal: false },
  { key: "obesity_pct", label: "Grau de obesidade", unit: "%", min: -60, max: 300, better: "down", principal: false },
  { key: "bone_kg", label: "Massa óssea", unit: "kg", min: 0.5, max: 10, better: "neutral", principal: false },
  { key: "protein_pct", label: "Proteína", unit: "%", min: 5, max: 40, better: "up", principal: false },
  { key: "metabolic_age", label: "Idade metabólica", unit: "anos", min: 10, max: 100, better: "down", principal: false, integer: true },
];

export const METRIC = Object.fromEntries(METRICS.map((m) => [m.key, m])) as Record<MetricKey, MetricDef>;

/** As 5 principais (card, gráficos, formulário em destaque). */
export const PRINCIPAL: MetricKey[] = METRICS.filter((m) => m.principal).map((m) => m.key);

/** Métricas que aceitam meta de composição (check de `composition_goals.metric`). */
export const GOAL_METRICS = ["weight_kg", "body_fat_pct", "skeletal_muscle_kg", "visceral_fat"] as const;
export type GoalMetric = (typeof GOAL_METRICS)[number];

/** Valores de uma medição (ausente ou `null` = não medido, nunca zero). */
export type MeasurementValues = Partial<Record<MetricKey, number | null>>;

const fmt = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });

/** Mensagens de erro da medição, na ordem do catálogo; vazio = válida. O peso é obrigatório. */
export function validateMeasurement(m: MeasurementValues): string[] {
  const errors: string[] = [];
  for (const def of METRICS) {
    const v = m[def.key];
    if (v === null || v === undefined) {
      if (def.key === "weight_kg") errors.push("Informe o peso.");
      continue;
    }
    if (!Number.isFinite(v) || v < def.min || v > def.max) {
      errors.push(`${def.label} entre ${fmt(def.min)} e ${fmt(def.max)}${def.unit ? ` ${def.unit}` : ""}.`);
    } else if (def.integer && !Number.isInteger(v)) {
      errors.push(`${def.label} deve ser um número inteiro.`);
    }
  }
  return errors;
}

// ── Variações e série ─────────────────────────────────────────────────────

/** Medição como vem do banco (só o que as funções abaixo leem). */
export type MeasurementLike = { measured_at: string; day?: string } & MeasurementValues;

export type Point = { day: string; value: number };

const valueOf = (m: MeasurementLike, key: MetricKey): number | null => {
  const v = m[key];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
};

const byInstant = <T extends MeasurementLike>(ms: readonly T[]) =>
  [...ms].sort((a, b) => Date.parse(a.measured_at) - Date.parse(b.measured_at));

/** Valores da métrica em ordem cronológica, pulando as medições sem ela. */
function valuesOf(ms: readonly MeasurementLike[], key: MetricKey): number[] {
  return byInstant(ms)
    .map((m) => valueOf(m, key))
    .filter((v): v is number => v !== null);
}

/** Última − primeira e última − anterior, entre as medições que têm a métrica; `null` com menos de 2. */
export function deltas(series: readonly MeasurementLike[], key: MetricKey): { sinceFirst: number | null; sincePrev: number | null } {
  const values = valuesOf(series, key);
  if (values.length < 2) return { sinceFirst: null, sincePrev: null };
  const last = values[values.length - 1];
  return { sinceFirst: last - values[0], sincePrev: last - values[values.length - 2] };
}

/** Pontos (dia de São Paulo, valor) da métrica, em ordem cronológica. */
export function metricSeries(ms: readonly MeasurementLike[], key: MetricKey): Point[] {
  return byInstant(ms).flatMap((m) => {
    const value = valueOf(m, key);
    return value === null ? [] : [{ day: m.day ?? dayInSaoPaulo(m.measured_at), value }];
  });
}

// ── Metas ─────────────────────────────────────────────────────────────────

/** Fração concluída (0–1) da partida ao alvo; partida igual ao alvo conta como concluída. */
export function goalProgress(start: number, current: number, target: number): number {
  if (start === target) return 1;
  const ratio = (start - current) / (start - target);
  return Math.min(1, Math.max(0, ratio));
}

/** Pontos mínimos para projetar. */
export const MIN_PROJECTION_POINTS = 3;
/** Inclinação (unidades por dia) abaixo da qual a tendência é considerada estável. */
export const FLAT_SLOPE = 1e-4;

export type Projection = { date: string } | { none: "insufficient" | "away" | "flat" | "reached" };

/**
 * Data em que a meta será atingida, pela regressão linear (mínimos quadrados) de valor × dia
 * sobre todo o histórico. `start` define a direção da meta (padrão: o primeiro valor).
 *
 * - `reached`: o valor atual já está no alvo ou além dele, na direção da meta;
 * - `insufficient`: menos de 3 medições;
 * - `flat`: inclinação próxima de zero;
 * - `away`: a tendência se afasta do alvo.
 *
 * A data é o primeiro dia inteiro em que a reta chega ao alvo, nunca antes do dia seguinte à
 * última medição (a reta pode cruzar o alvo no passado sem que o valor medido tenha chegado).
 */
export function projectGoal(points: readonly Point[], target: number, start?: number): Projection {
  const pts = [...points].sort((a, b) => dayToTime(a.day) - dayToTime(b.day));
  if (pts.length === 0) return { none: "insufficient" };

  const from = start ?? pts[0].value;
  const current = pts[pts.length - 1].value;
  const direction = Math.sign(target - from);
  if (direction === 0 || (direction < 0 ? current <= target : current >= target)) return { none: "reached" };
  if (pts.length < MIN_PROJECTION_POINTS) return { none: "insufficient" };

  const first = pts[0].day;
  const xs = pts.map((p) => (dayToTime(p.day) - dayToTime(first)) / 86_400_000);
  const ys = pts.map((p) => p.value);
  const n = pts.length;
  const mx = xs.reduce((s, x) => s + x, 0) / n;
  const my = ys.reduce((s, y) => s + y, 0) / n;
  let sxy = 0;
  let sxx = 0;
  for (let i = 0; i < n; i++) {
    sxy += (xs[i] - mx) * (ys[i] - my);
    sxx += (xs[i] - mx) ** 2;
  }
  // Todas no mesmo dia: não há tendência.
  const slope = sxx === 0 ? 0 : sxy / sxx;
  if (Math.abs(slope) < FLAT_SLOPE) return { none: "flat" };
  if (Math.sign(slope) !== direction) return { none: "away" };

  const intercept = my - slope * mx;
  // Tolerância de ponto flutuante: 49,99999999 dias ainda é o dia 50.
  const x = Math.ceil((target - intercept) / slope - 1e-9);
  const lastX = xs[n - 1];
  return { date: addDays(first, Math.max(x, lastX + 1)) };
}
