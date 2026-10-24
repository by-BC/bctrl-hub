/**
 * Cartões do resumo do mês (RF13 + RF26): cada número com a variação contra o mês anterior.
 * Puro (sem I/O): recebe o `month_summary` e as médias de nutrição já calculadas.
 */

import { monthDelta, monthShort, type MonthDelta } from "@/features/profile/domain/month-view";
import type { MonthNutrition } from "@/features/nutrition/domain/nutrition";
import { formatInt, formatKg } from "@/lib/format";
import type { MonthNumbers, MonthSummary } from "./api";

export type StatValue =
  | { kind: "number"; text: string; unit?: string }
  /** Mês sem nenhum registro (ex.: refeições na época do Hevy): "sem registros", nunca 0%. */
  | { kind: "empty" }
  /** Ainda carregando algo de que o número depende (plano, TACO, perfil). */
  | { kind: "loading" };

export type Stat = {
  key: string;
  label: string;
  value: StatValue;
  /** Linha de apoio ("de 31 dias", "meta 2.400 kcal"). */
  detail?: string;
  /** O número tem meta, mas ela ainda não existe (perfil incompleto ou sem peso). */
  missingGoal?: boolean;
  delta: MonthDelta;
};

const num = (text: string, unit?: string): StatValue => ({ kind: "number", text, unit });
const int = (n: number) => formatInt(Math.round(n));
const withUnit = (unit: string) => (n: number) => `${int(n)} ${unit}`;
const plural = (n: number, one: string, many: string) => `${formatInt(n)} ${n === 1 ? one : many}`;

/** Houve registro de refeição no mês? Sem isso, adesão e nutrição não têm número. */
export const hasMealRecords = (m: MonthNumbers) => m.nutrition.logged_days > 0;

const adherence = (m: MonthNumbers) => (hasMealRecords(m) ? m.meals.pct : null);

export type NutritionPair = { current: MonthNutrition; previous: MonthNutrition } | null;

/**
 * Os cartões do mês, na ordem de leitura. `nutrition` é `null` enquanto o plano, a TACO ou o
 * perfil carregam (os dois cartões de nutrição mostram esqueleto, o resto não espera).
 */
export function summaryStats(summary: MonthSummary, nutrition: NutritionPair): Stat[] {
  const c = summary.current;
  const p = summary.previous;
  const prev = monthShort(p.month);
  const delta = (cur: number | null, old: number | null, format: (n: number) => string) =>
    monthDelta(cur, old, prev, format);

  const macro = (key: "kcal" | "protein", label: string, unit: string): Stat => {
    const fmt = withUnit(unit);
    if (!hasMealRecords(c)) {
      return { key, label, value: { kind: "empty" }, delta: monthDelta(null, null, prev, fmt) };
    }
    if (!nutrition) return { key, label, value: { kind: "loading" }, delta: { direction: "none", text: "" } };
    const cur = nutrition.current.consumed?.[key] ?? null;
    const old = hasMealRecords(p) ? (nutrition.previous.consumed?.[key] ?? null) : null;
    const goal = nutrition.current.goal?.[key] ?? null;
    return {
      key,
      label,
      value: cur === null ? { kind: "empty" } : num(int(cur), unit),
      detail: goal === null ? undefined : `meta ${int(goal)} ${unit}`,
      missingGoal: goal === null,
      delta: delta(cur, old, fmt),
    };
  };

  return [
    {
      key: "workouts",
      label: "Treinos",
      value: num(formatInt(c.workouts)),
      delta: delta(c.workouts, p.workouts, formatInt),
    },
    {
      key: "volume",
      label: "Volume total",
      value: num(int(c.volume_kg), "kg"),
      delta: delta(c.volume_kg, p.volume_kg, withUnit("kg")),
    },
    {
      key: "prs",
      label: "Recordes",
      value: num(formatInt(c.prs.count)),
      delta: delta(c.prs.count, p.prs.count, formatInt),
    },
    {
      key: "control",
      label: "Dias no controle",
      value: num(formatInt(c.control_days)),
      detail: `de ${plural(c.days, "dia", "dias")}`,
      delta: delta(c.control_days, p.control_days, formatInt),
    },
    {
      key: "adherence",
      label: "Adesão alimentar",
      value: hasMealRecords(c) ? num(formatInt(c.meals.pct), "%") : { kind: "empty" },
      detail: hasMealRecords(c) ? `${formatInt(c.meals.done)} de ${plural(c.meals.planned, "refeição", "refeições")}` : undefined,
      delta: delta(adherence(c), adherence(p), (n) => `${int(n)} p.p.`),
    },
    {
      key: "cardio",
      label: "Cardio",
      value: num(formatInt(c.cardio.minutes), "min"),
      detail: `${formatKg(Math.round(c.cardio.distance_km * 10) / 10)} km · ${plural(c.cardio.sessions, "sessão", "sessões")}`,
      delta: delta(c.cardio.minutes, p.cardio.minutes, withUnit("min")),
    },
    macro("kcal", "kcal por dia", "kcal"),
    macro("protein", "Proteína por dia", "g"),
  ];
}
