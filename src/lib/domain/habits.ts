/**
 * Progresso e sequência (streak) de hábitos. Sem I/O.
 *
 * Mesmas regras do `week_summary` no banco:
 * - `check`: conta dias distintos com registro (marcar 2x no mesmo dia vale 1);
 * - `quantity` e `cardio`: somam `value` (no cardio, minutos);
 * - meta da semana: `target` se o período é semanal, `target × 7` se é diário.
 */

import { addWeeks, weekDays } from "./week";

export type HabitKind = "check" | "quantity" | "cardio";
export type HabitPeriod = "day" | "week";

/** Tipos de cardio: valor gravado no banco (inglês) → rótulo da tela. */
export const CARDIO_TYPES = [
  { value: "treadmill", label: "Esteira" },
  { value: "bike", label: "Bike" },
  { value: "stairs", label: "Escada" },
  { value: "walk", label: "Caminhada" },
  { value: "run", label: "Corrida" },
  { value: "other", label: "Outro" },
] as const;
export type CardioType = (typeof CARDIO_TYPES)[number]["value"];

export function cardioLabel(type: string | null | undefined): string {
  return CARDIO_TYPES.find((t) => t.value === type)?.label ?? "Cardio";
}

export type HabitLike ={ kind: HabitKind | string; period: HabitPeriod | string; target: number };
export type HabitLogLike = {
  day: string;
  value: number;
  distance_km?: number | null;
  kcal?: number | null;
};

export type HabitProgress = {
  /** Feito na semana (dias para `check`, soma de `value` para os outros). */
  done: number;
  /** Meta da semana. */
  target: number;
  /** 0–100, para a barra. */
  pct: number;
  met: boolean;
  /** Feito em cada dia da semana (dias sem registro ficam em 0). */
  byDay: Record<string, number>;
  /** Registros da semana (sessões de cardio, por exemplo). */
  sessions: number;
  distanceKm: number;
  kcal: number;
};

/** Meta da semana do hábito. */
export function weekTarget(habit: HabitLike): number {
  return habit.period === "day" ? habit.target * 7 : habit.target;
}

/** Meta de um dia (hábito diário): 1 dia feito para `check`, `target` para os outros. */
export function dayTarget(habit: HabitLike): number {
  return habit.kind === "check" ? 1 : habit.target;
}

// Soma em centésimos: 0,1 + 0,2 não vira 0,30000000000000004.
const round2 = (n: number) => Math.round(n * 100) / 100;

/** Progresso do hábito na semana que começa em `week`, a partir dos registros (de qualquer período). */
export function habitProgress(habit: HabitLike, logs: readonly HabitLogLike[], week: string): HabitProgress {
  const days = weekDays(week);
  const inWeek = new Set(days);
  const byDay: Record<string, number> = Object.fromEntries(days.map((d) => [d, 0]));
  let sessions = 0;
  let distanceKm = 0;
  let kcal = 0;

  for (const log of logs) {
    if (!inWeek.has(log.day)) continue;
    sessions += 1;
    distanceKm += log.distance_km ?? 0;
    kcal += log.kcal ?? 0;
    byDay[log.day] = habit.kind === "check" ? 1 : round2(byDay[log.day] + log.value);
  }

  const done = round2(days.reduce((sum, d) => sum + byDay[d], 0));
  const target = weekTarget(habit);
  return {
    done,
    target,
    pct: target > 0 ? Math.min(100, Math.round((done / target) * 100)) : 0,
    met: done >= target,
    byDay,
    sessions,
    distanceKm: round2(distanceKm),
    kcal: Math.round(kcal),
  };
}

/** O dia do hábito diário está cumprido? */
export function dayMet(habit: HabitLike, progress: HabitProgress, day: string): boolean {
  return (progress.byDay[day] ?? 0) >= dayTarget(habit);
}

/** Agrupa registros pela segunda-feira da semana de cada um. */
export function groupByWeek<T extends { day: string }>(logs: readonly T[], weekOf: (day: string) => string) {
  const byWeek = new Map<string, T[]>();
  for (const log of logs) {
    const key = weekOf(log.day);
    const list = byWeek.get(key);
    if (list) list.push(log);
    else byWeek.set(key, [log]);
  }
  return byWeek;
}

/** Até onde o streak olha para trás (semanas). */
export const STREAK_MAX_WEEKS = 52;

/**
 * Sequência de semanas consecutivas com a meta cumprida, terminando na semana atual.
 * A semana atual (em andamento) soma se já cumpriu a meta, mas não quebra a sequência
 * enquanto não cumpre. Uma semana passada sem a meta encerra a contagem.
 */
export function streak(
  habit: HabitLike,
  logsByWeek: ReadonlyMap<string, readonly HabitLogLike[]>,
  currentWeek: string,
): number {
  const metIn = (week: string) => habitProgress(habit, logsByWeek.get(week) ?? [], week).met;
  let count = metIn(currentWeek) ? 1 : 0;
  for (let i = 1; i <= STREAK_MAX_WEEKS; i++) {
    const week = addWeeks(currentWeek, -i);
    if (!metIn(week)) break;
    count += 1;
  }
  return count;
}
