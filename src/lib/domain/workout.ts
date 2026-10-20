/**
 * Regras puras da sessão de treino (sem I/O).
 * Recordes (PR) por carga, volume da série e 1RM estimado (Epley) nas séries com carga e
 * reps; por duração e distância nos exercícios desses tipos. Empate não é PR.
 * Aquecimento não conta para recordes, volume nem contagem de séries.
 */

import {
  DEFAULT_EXERCISE_TYPE,
  hasLoadAndReps,
  isSetComplete,
  isValidValue,
  RECORD_KINDS,
  type ExerciseType,
  type PrKind,
  type SetMetrics,
  type SetType,
} from "./exercise-types";

export type { PrKind } from "./exercise-types";

export type SetEntry = SetMetrics & { done: boolean; setType?: SetType };

/** Melhores marcas do exercício. Métrica ausente (ou nula) = sem referência ainda. */
export type Bests = {
  maxWeight?: number | null;
  maxSetVolume?: number | null;
  maxE1rm?: number | null;
  maxDurationS?: number | null;
  maxDistanceM?: number | null;
};

const BEST_KEY: Record<PrKind, keyof Bests> = {
  weight: "maxWeight",
  volume: "maxSetVolume",
  e1rm: "maxE1rm",
  duration: "maxDurationS",
  distance: "maxDistanceM",
};
const ALL_KINDS = Object.keys(BEST_KEY) as PrKind[];

/** 1RM estimado (Epley). Com 1 repetição (ou menos), a própria carga. */
export const e1rm = (kg: number, reps: number) => (reps <= 1 ? kg : kg * (1 + reps / 30));

export const isWarmup = (set: Pick<SetEntry, "setType">) => set.setType === "warmup";

/** Série concluída e completa para o tipo do exercício: a única que conta e vai ao banco. */
export function isCountable(set: SetEntry, type: ExerciseType = DEFAULT_EXERCISE_TYPE): boolean {
  return set.done && isSetComplete(type, set);
}

export function setVolume(set: Pick<SetEntry, "weightKg" | "reps">): number {
  return set.weightKg === null || set.reps === null ? 0 : set.weightKg * set.reps;
}

/** Valor da série para cada tipo de recorde (`null` quando não se aplica). */
function metric(set: SetEntry, kind: PrKind): number | null {
  if (kind === "duration") {
    const d = set.durationS ?? null;
    return d !== null && isValidValue("duration", d) ? d : null;
  }
  if (kind === "distance") {
    const d = set.distanceM ?? null;
    return d !== null && isValidValue("distance", d) ? d : null;
  }
  if (!hasLoadAndReps(set) || !isValidValue("weight", set.weightKg!) || !isValidValue("reps", set.reps!)) return null;
  if (kind === "weight") return set.weightKg;
  if (kind === "volume") return setVolume(set);
  return e1rm(set.weightKg!, set.reps!);
}

// O banco guarda e1RM com 2 casas (views); comparar arredondado evita "PR" por resíduo de ponto flutuante.
const round2 = (n: number) => Math.round(n * 100) / 100;
const beats = (value: number, best: number) => round2(value) > round2(best);

/**
 * Quais recordes a série bate. Sem `bests` (primeira vez no exercício) não há o que bater:
 * o primeiro registro só estabelece a referência. O mesmo vale para cada métrica sem marca.
 */
export function detectPrs(
  set: SetEntry,
  bests: Bests | null,
  type: ExerciseType = DEFAULT_EXERCISE_TYPE,
): PrKind[] {
  if (!bests || isWarmup(set) || !isCountable(set, type)) return [];
  const prs: PrKind[] = [];
  for (const kind of RECORD_KINDS[type]) {
    const value = metric(set, kind);
    const best = bests[BEST_KEY[kind]];
    if (value !== null && best !== null && best !== undefined && beats(value, best)) prs.push(kind);
  }
  return prs;
}

/** Recordes depois de contar mais uma série (aquecimento ou série sem métrica não muda nada). */
export function mergeBests(bests: Bests | null, set: SetEntry): Bests | null {
  if (!set.done || isWarmup(set)) return bests;
  let merged: Bests | null = bests;
  for (const kind of ALL_KINDS) {
    const value = metric(set, kind);
    if (value === null) continue;
    const key = BEST_KEY[kind];
    const current = merged?.[key];
    merged = { ...merged, [key]: current === null || current === undefined ? value : Math.max(current, value) };
  }
  return merged;
}

/**
 * PRs de cada série de um exercício na sessão, em ordem: cada série concluída é comparada
 * com os recordes do histórico somados às séries concluídas antes dela na mesma sessão.
 * Sem histórico, nenhuma série da primeira sessão é PR.
 */
export function markSessionPrs(
  sets: readonly SetEntry[],
  bests: Bests | null,
  type: ExerciseType = DEFAULT_EXERCISE_TYPE,
): PrKind[][] {
  if (!bests) return sets.map(() => []);
  let running: Bests = bests;
  return sets.map((set) => {
    const prs = detectPrs(set, running, type);
    if (isCountable(set, type)) running = mergeBests(running, set) ?? running;
    return prs;
  });
}

export type SessionSummary = { durationMin: number; sets: number; volumeKg: number; prs: number };

/** Resumo do fim do treino: duração, volume, séries e PRs (só séries de trabalho que contam). */
export function summarizeSession(
  exercises: readonly { type?: ExerciseType; sets: readonly (SetEntry & { prs: readonly PrKind[] })[] }[],
  startedAt: string,
  finishedAt: string,
): SessionSummary {
  let sets = 0;
  let volumeKg = 0;
  let prs = 0;
  for (const exercise of exercises) {
    for (const set of exercise.sets) {
      if (isWarmup(set) || !isCountable(set, exercise.type)) continue;
      sets += 1;
      volumeKg += metric(set, "volume") ?? 0;
      prs += set.prs.length;
    }
  }
  const durationMin = Math.max(0, Math.floor((Date.parse(finishedAt) - Date.parse(startedAt)) / 60_000));
  return { durationMin, sets, volumeKg: round2(volumeKg), prs };
}

export type SequenceRoutine = { id: string; position: number; archivedAt?: string | null };

/**
 * Próxima rotina da sequência fixa (U1 → L1 → U2 → L2 → U1…) depois da última sessão finalizada.
 * Rotinas arquivadas saem da sequência; se a última foi arquivada depois, segue a partir da
 * posição dela. Sem histórico (ou se a última foi excluída), a primeira. Sem rotina ativa, `null`.
 */
export function nextRoutineId(routines: readonly SequenceRoutine[], lastRoutineId: string | null): string | null {
  const byPosition = [...routines].sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));
  const active = byPosition.filter((r) => !r.archivedAt);
  if (active.length === 0) return null;

  const last = lastRoutineId ? byPosition.find((r) => r.id === lastRoutineId) : undefined;
  if (!last) return active[0].id;

  const after = active.find(
    (r) => r.position > last.position || (r.position === last.position && r.id.localeCompare(last.id) > 0),
  );
  return (after ?? active[0]).id;
}
