/**
 * Card do mês (RF17): os dados do layout `MonthCard` do Story Studio, a partir do
 * `month_summary` (números do mês), do `daily_scores` (heatmap) e das conquistas já avaliadas
 * sobre o histórico inteiro. Sem I/O.
 */

import { heatmapLevel, type ScoreValue } from "./score";
import { addDays } from "./stats";
import { monthEnd, monthStart, weekStart } from "./week";

export type MonthCompositionPoint = {
  day: string;
  weight_kg: number;
  body_fat_pct: number | null;
  skeletal_muscle_kg: number | null;
};

export type MonthComposition = {
  count: number;
  first: MonthCompositionPoint;
  last: MonthCompositionPoint;
  change: {
    weight_kg: number;
    body_fat_pct: number | null;
    skeletal_muscle_kg: number | null;
  };
};

/** O que o card usa do `month_summary` (mês corrente da resposta). */
export type MonthCardSummary = {
  /** 1º dia do mês. */
  month: string;
  /** Dias contados (até hoje, no mês em curso). */
  days: number;
  workouts: number;
  volume_kg: number;
  prs: { count: number };
  control_days: number;
  meals: { planned: number; done: number; pct: number };
  nutrition: { logged_days: number };
  composition: MonthComposition | null;
};

export type MonthCardInput = {
  summary: MonthCardSummary;
  /** Pontuação dos dias do mês (dias sem linha valem 0). */
  scores: readonly { day: string; score: number }[];
  /** Conquistas avaliadas (`evaluateAchievements`); entram as desbloqueadas no mês. */
  achievements: readonly { key: string; title: string; unlockedOn: string | null }[];
  /** Hoje (AAAA-MM-DD, São Paulo). */
  today: string;
};

/** Um dia do mini-heatmap. `level` é `null` nos dias que ainda não chegaram. */
export type MonthCardDay = { date: string; day: number; level: ScoreValue | null };

export type MonthCardData = {
  /** 1º dia do mês. */
  month: string;
  /** "AAAA-MM" (nome do arquivo e rota). */
  key: string;
  /** "outubro". */
  monthName: string;
  /** "2026". */
  year: string;
  /** Mês em curso: os números valem até `today`. */
  partial: boolean;
  today: string;
  /** Dias contados no mês (até hoje, no mês em curso). */
  days: number;
  controlDays: number;
  workouts: number;
  volumeKg: number;
  prs: number;
  /** `null` = mês sem registro de refeição ("sem registros", como no Perfil). */
  adherence: { pct: number; done: number; planned: number } | null;
  /** Variação dentro do mês; `null` quando não houve medição. */
  composition: { bodyFatPct: number | null; skeletalMuscleKg: number | null } | null;
  /** Semanas de segunda a domingo; `null` = dia de outro mês (célula vazia). */
  weeks: (MonthCardDay | null)[][];
  /** Conquistas desbloqueadas no mês, na ordem em que aconteceram. */
  achievements: { key: string; title: string; unlockedOn: string }[];
};

const monthOnly = new Intl.DateTimeFormat("pt-BR", { month: "long", timeZone: "UTC" });

/** "2026-10" → "2026-10-01"; qualquer outra coisa (mês 13, "2026-1", texto) → `null`. */
export function parseMonthParam(param: string): string | null {
  const match = /^(\d{4})-(\d{2})$/.exec(param);
  if (!match) return null;
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  return `${match[1]}-${match[2]}-01`;
}

/** "2026-10-01" → "2026-10". */
export const monthParam = (month: string) => month.slice(0, 7);

/** Semanas (segunda a domingo) que cobrem o mês, com `null` fora dele. */
function calendar(month: string, levelOf: (day: string) => ScoreValue | null): (MonthCardDay | null)[][] {
  const first = monthStart(month);
  const last = monthEnd(month);
  const weeks: (MonthCardDay | null)[][] = [];
  for (let start = weekStart(first); start <= last; start = addDays(start, 7)) {
    const week: (MonthCardDay | null)[] = [];
    for (let i = 0; i < 7; i++) {
      const date = addDays(start, i);
      week.push(date < first || date > last ? null : { date, day: Number(date.slice(8)), level: levelOf(date) });
    }
    weeks.push(week);
  }
  return weeks;
}

export function buildMonthCardData({ summary, scores, achievements, today }: MonthCardInput): MonthCardData {
  const month = monthStart(summary.month);
  const end = monthEnd(month);
  const byDay = new Map(scores.map((s) => [s.day, s.score]));
  const hasMeals = summary.nutrition.logged_days > 0;

  return {
    month,
    key: monthParam(month),
    monthName: monthOnly.format(new Date(`${month}T12:00:00Z`)),
    year: month.slice(0, 4),
    partial: month === monthStart(today),
    today,
    days: summary.days,
    controlDays: summary.control_days,
    workouts: summary.workouts,
    volumeKg: Number(summary.volume_kg),
    prs: summary.prs.count,
    adherence: hasMeals ? { pct: summary.meals.pct, done: summary.meals.done, planned: summary.meals.planned } : null,
    composition: summary.composition ? {
      bodyFatPct: summary.composition.change.body_fat_pct === null ? null : Number(summary.composition.change.body_fat_pct),
      skeletalMuscleKg: summary.composition.change.skeletal_muscle_kg === null
        ? null
        : Number(summary.composition.change.skeletal_muscle_kg),
    } : null,
    // O futuro nunca aparece preenchido (mesma regra do heatmap do Perfil).
    weeks: calendar(month, (day) => (day > today ? null : heatmapLevel(byDay.get(day) ?? 0))),
    achievements: achievements
      .flatMap((a) => (a.unlockedOn && a.unlockedOn >= month && a.unlockedOn <= end ? [{ key: a.key, title: a.title, unlockedOn: a.unlockedOn }] : []))
      .sort((a, b) => a.unlockedOn.localeCompare(b.unlockedOn)),
  };
}
