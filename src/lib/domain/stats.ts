/**
 * Estatísticas de evolução (sem I/O): séries dos gráficos, filtro de período,
 * média móvel do peso corporal, histórico e recordes por exercício.
 * Dias são datas puras "AAAA-MM-DD" (já calculadas em America/Sao_Paulo).
 */

import { FIELDS, type ExerciseType } from "./exercise-types";

const DAY_MS = 86_400_000;

/** "2026-10-13" → instante 00:00 UTC do dia (eixo de tempo dos gráficos). */
export function dayToTime(day: string): number {
  const [y, m, d] = day.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

/** Dia "AAAA-MM-DD" deslocado em `delta` dias. */
export function addDays(day: string, delta: number): string {
  return new Date(dayToTime(day) + delta * DAY_MS).toISOString().slice(0, 10);
}

// ── Período ───────────────────────────────────────────────────────────────

export const RANGES = ["1m", "3m", "all"] as const;
export type Range = (typeof RANGES)[number];

export const RANGE_LABEL: Record<Range, string> = { "1m": "1 mês", "3m": "3 meses", all: "Tudo" };

/** 1 mês = últimos 30 dias, 3 meses = últimos 90 (contando hoje). */
const RANGE_DAYS: Record<Exclude<Range, "all">, number> = { "1m": 30, "3m": 90 };

/** Primeiro dia incluído no período, ou `null` para "tudo". */
export function rangeStart(range: Range, today: string): string | null {
  return range === "all" ? null : addDays(today, -(RANGE_DAYS[range] - 1));
}

/** Pontos do período (inclui o primeiro dia e hoje). Não altera a ordem. */
export function filterByRange<T extends { day: string }>(points: readonly T[], range: Range, today: string): T[] {
  const start = rangeStart(range, today);
  return points.filter((p) => (start === null || p.day >= start) && p.day <= today);
}

// ── Séries por exercício (v_exercise_session_stats) ───────────────────────

export const METRICS = ["weight", "e1rm", "volume", "distance", "duration"] as const;
export type Metric = (typeof METRICS)[number];

export const METRIC_LABEL: Record<Metric, string> = {
  weight: "Melhor carga",
  e1rm: "1RM estimado",
  volume: "Volume",
  distance: "Maior distância",
  duration: "Maior duração",
};

/**
 * Métricas de evolução de cada tipo de exercício: carga, 1RM e volume quando a série tem
 * carga e reps; distância e duração quando o tipo as registra. Só reps: nenhuma (só histórico).
 */
export function metricsFor(type: ExerciseType): Metric[] {
  const fields = FIELDS[type];
  const metrics: Metric[] = [];
  if (fields.includes("weight") && fields.includes("reps")) metrics.push("weight", "e1rm", "volume");
  if (fields.includes("distance")) metrics.push("distance");
  if (fields.includes("duration")) metrics.push("duration");
  return metrics;
}

/** Linha da view como chega do PostgREST (colunas da view são anuláveis). */
export type SessionStatRow = {
  workout_id: string | null;
  day: string | null;
  started_at: string | null;
  best_weight: number | null;
  best_e1rm: number | null;
  volume: number | null;
  sets: number | null;
  best_duration_s?: number | null;
  best_distance_m?: number | null;
};

/** Um treino no gráfico. Métrica que o treino não registrou (ex.: carga na prancha) = `null`. */
export type SessionPoint = {
  workoutId: string;
  day: string;
  /** Eixo X: dia em ms (UTC). */
  t: number;
  weight: number | null;
  e1rm: number | null;
  volume: number | null;
  /** Metros. */
  distance: number | null;
  /** Segundos. */
  duration: number | null;
  sets: number;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

const orNull = (v: number | null | undefined) => (v === null || v === undefined ? null : round2(Number(v)));

/** Linhas da view → pontos do gráfico, do mais antigo para o mais recente. Linhas sem métrica saem. */
export function toSessionSeries(rows: readonly SessionStatRow[]): SessionPoint[] {
  return rows
    .filter(
      (r) =>
        r.workout_id &&
        r.day &&
        (r.best_weight !== null || (r.best_duration_s ?? null) !== null || (r.best_distance_m ?? null) !== null),
    )
    .sort((a, b) => a.day!.localeCompare(b.day!) || (a.started_at ?? "").localeCompare(b.started_at ?? ""))
    .map((r) => {
      const load = r.best_weight !== null;
      return {
        workoutId: r.workout_id!,
        day: r.day!,
        t: dayToTime(r.day!),
        weight: orNull(r.best_weight),
        e1rm: load ? round2(Number(r.best_e1rm ?? r.best_weight)) : null,
        volume: load ? round2(Number(r.volume ?? 0)) : null,
        distance: orNull(r.best_distance_m),
        duration: orNull(r.best_duration_s),
        sets: r.sets ?? 0,
      };
    });
}

// ── Peso corporal ─────────────────────────────────────────────────────────

export type DayValue = { day: string; value: number };
export type AveragedPoint = DayValue & { t: number; average: number };

/**
 * Média móvel por calendário: para cada registro, a média dos registros dos últimos
 * `window` dias (ele incluso). Dia sem registro não conta como zero, só fica de fora;
 * com menos registros que a janela, a média usa os que existem.
 */
export function movingAverage<P extends DayValue>(points: readonly P[], window: number): (P & AveragedPoint)[] {
  if (!Number.isInteger(window) || window < 1) throw new RangeError("janela deve ser um inteiro ≥ 1");
  const sorted = [...points].sort((a, b) => a.day.localeCompare(b.day));
  return sorted.map((point, i) => {
    const t = dayToTime(point.day);
    const from = t - (window - 1) * DAY_MS;
    let sum = 0;
    let count = 0;
    for (let j = i; j >= 0; j--) {
      const tj = dayToTime(sorted[j].day);
      if (tj < from) break;
      sum += sorted[j].value;
      count++;
    }
    return { ...point, t, average: round2(sum / count) };
  });
}

// ── Histórico de séries e recordes por exercício ──────────────────────────

export type ExerciseSetRow = {
  id: string;
  position: number;
  set_type?: string | null;
  weight_kg: number | null;
  reps: number | null;
  distance_m?: number | null;
  duration_s?: number | null;
  pr_kinds: string[];
};

/** Ocorrência do exercício num treino (o mesmo treino pode ter o exercício duas vezes). */
export type ExerciseOccurrenceRow = {
  id: string;
  position: number;
  workout: {
    id: string;
    day: string;
    started_at: string;
    finished_at: string | null;
    routine: { name: string } | null;
  } | null;
  workout_sets: ExerciseSetRow[];
};

export type ExerciseSession = {
  workoutId: string;
  day: string;
  startedAt: string;
  routineName: string | null;
  sets: ExerciseSetRow[];
};

/** Agrupa as ocorrências por treino finalizado, do mais recente para o mais antigo. */
export function groupExerciseHistory(rows: readonly ExerciseOccurrenceRow[]): ExerciseSession[] {
  const byWorkout = new Map<string, { session: ExerciseSession; parts: ExerciseOccurrenceRow[] }>();
  for (const row of rows) {
    const w = row.workout;
    if (!w || !w.finished_at) continue;
    const entry = byWorkout.get(w.id) ?? {
      session: { workoutId: w.id, day: w.day, startedAt: w.started_at, routineName: w.routine?.name ?? null, sets: [] },
      parts: [],
    };
    entry.parts.push(row);
    byWorkout.set(w.id, entry);
  }
  return [...byWorkout.values()]
    .map(({ session, parts }) => ({
      ...session,
      sets: parts
        .sort((a, b) => a.position - b.position)
        .flatMap((p) => [...p.workout_sets].sort((a, b) => a.position - b.position)),
    }))
    .sort((a, b) => b.day.localeCompare(a.day) || b.startedAt.localeCompare(a.startedAt));
}

export type PrEntry = {
  setId: string;
  workoutId: string;
  day: string;
  weightKg: number | null;
  reps: number | null;
  distanceM: number | null;
  durationS: number | null;
  kinds: string[];
};

/** Séries que bateram recorde, da mais recente para a mais antiga. */
export function listPrs(sessions: readonly ExerciseSession[]): PrEntry[] {
  return sessions.flatMap((s) =>
    s.sets
      .filter((set) => set.pr_kinds.length > 0)
      .map((set) => ({
        setId: set.id,
        workoutId: s.workoutId,
        day: s.day,
        weightKg: set.weight_kg === null ? null : Number(set.weight_kg),
        reps: set.reps,
        distanceM: set.distance_m == null ? null : Number(set.distance_m),
        durationS: set.duration_s ?? null,
        kinds: set.pr_kinds,
      })),
  );
}

/** Último dia treinado de cada exercício (lista de /evolucao). */
export function lastDayByExercise(rows: readonly { exercise_id: string | null; day: string | null }[]) {
  const last = new Map<string, string>();
  for (const r of rows) {
    if (!r.exercise_id || !r.day) continue;
    const current = last.get(r.exercise_id);
    if (!current || r.day > current) last.set(r.exercise_id, r.day);
  }
  return last;
}

// ── Eixo Y ────────────────────────────────────────────────────────────────

const NICE_STEPS = [1, 2, 2.5, 5, 10];

/**
 * Domínio e marcas "redondas" para o eixo Y (ex.: 81,5 a 84,2 → 81 a 85, de 1 em 1),
 * com no máximo `maxTicks` marcas. Valor único ganha uma folga de um passo para cada lado.
 */
export function niceAxis(values: readonly number[], maxTicks = 5): { domain: [number, number]; ticks: number[] } {
  if (values.length === 0) return { domain: [0, 1], ticks: [0, 1] };
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (min === max) {
    const pad = Math.max(Math.abs(min) * 0.05, 0.5);
    min -= pad;
    max += pad;
  }
  const rough = (max - min) / Math.max(1, maxTicks - 1);
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  let step = magnitude * 10;
  let lo = min;
  let hi = max;
  for (const m of NICE_STEPS) {
    const s = magnitude * m;
    const a = Math.floor(min / s) * s;
    const b = Math.ceil(max / s) * s;
    if (Math.round((b - a) / s) + 1 <= maxTicks) {
      step = s;
      lo = a;
      hi = b;
      break;
    }
  }
  if (step === magnitude * 10) {
    lo = Math.floor(min / step) * step;
    hi = Math.ceil(max / step) * step;
  }
  const count = Math.round((hi - lo) / step);
  const ticks = Array.from({ length: count + 1 }, (_, i) => round2(lo + i * step));
  return { domain: [round2(lo), round2(hi)], ticks };
}
