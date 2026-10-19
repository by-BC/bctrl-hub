/**
 * Regras puras da sessão de treino (sem I/O).
 * Recordes (PR) por carga, volume da série e 1RM estimado (Epley). Empate não é PR.
 */

export type SetEntry = { weightKg: number | null; reps: number | null; done: boolean };
export type Bests = { maxWeight: number; maxSetVolume: number; maxE1rm: number };
export type PrKind = "weight" | "volume" | "e1rm";

/** 1RM estimado (Epley). Com 1 repetição (ou menos), a própria carga. */
export const e1rm = (kg: number, reps: number) => (reps <= 1 ? kg : kg * (1 + reps / 30));

/** Série concluída com carga (≥ 0) e reps inteiras (≥ 1): a única que conta e vai ao banco. */
export function isCountable(set: SetEntry): set is SetEntry & { weightKg: number; reps: number } {
  return (
    set.done &&
    set.weightKg !== null &&
    Number.isFinite(set.weightKg) &&
    set.weightKg >= 0 &&
    set.reps !== null &&
    Number.isInteger(set.reps) &&
    set.reps >= 1
  );
}

export function setVolume(set: Pick<SetEntry, "weightKg" | "reps">): number {
  return set.weightKg === null || set.reps === null ? 0 : set.weightKg * set.reps;
}

// O banco guarda e1RM com 2 casas (views); comparar arredondado evita "PR" por resíduo de ponto flutuante.
const round2 = (n: number) => Math.round(n * 100) / 100;
const beats = (value: number, best: number) => round2(value) > round2(best);

/**
 * Quais recordes a série bate. Sem `bests` (primeira vez no exercício) não há o que bater:
 * o primeiro registro só estabelece a referência.
 */
export function detectPrs(set: SetEntry, bests: Bests | null): PrKind[] {
  if (!bests || !isCountable(set)) return [];
  const prs: PrKind[] = [];
  if (beats(set.weightKg, bests.maxWeight)) prs.push("weight");
  if (beats(setVolume(set), bests.maxSetVolume)) prs.push("volume");
  if (beats(e1rm(set.weightKg, set.reps), bests.maxE1rm)) prs.push("e1rm");
  return prs;
}

/** Recordes depois de contar mais uma série (série inválida não muda nada). */
export function mergeBests(bests: Bests | null, set: SetEntry): Bests | null {
  if (!isCountable(set)) return bests;
  const current: Bests = {
    maxWeight: set.weightKg,
    maxSetVolume: setVolume(set),
    maxE1rm: e1rm(set.weightKg, set.reps),
  };
  if (!bests) return current;
  return {
    maxWeight: Math.max(bests.maxWeight, current.maxWeight),
    maxSetVolume: Math.max(bests.maxSetVolume, current.maxSetVolume),
    maxE1rm: Math.max(bests.maxE1rm, current.maxE1rm),
  };
}

/**
 * PRs de cada série de um exercício na sessão, em ordem: cada série concluída é comparada
 * com os recordes do histórico somados às séries concluídas antes dela na mesma sessão.
 * Sem histórico, nenhuma série da primeira sessão é PR.
 */
export function markSessionPrs(sets: readonly SetEntry[], bests: Bests | null): PrKind[][] {
  if (!bests) return sets.map(() => []);
  let running: Bests = bests;
  return sets.map((set) => {
    const prs = detectPrs(set, running);
    running = mergeBests(running, set) ?? running;
    return prs;
  });
}

export type SessionSummary = { durationMin: number; sets: number; volumeKg: number; prs: number };

/** Resumo do fim do treino: duração, volume, séries e PRs (só séries que contam). */
export function summarizeSession(
  exercises: readonly { sets: readonly (SetEntry & { prs: readonly PrKind[] })[] }[],
  startedAt: string,
  finishedAt: string,
): SessionSummary {
  let sets = 0;
  let volumeKg = 0;
  let prs = 0;
  for (const exercise of exercises) {
    for (const set of exercise.sets) {
      if (!isCountable(set)) continue;
      sets += 1;
      volumeKg += setVolume(set);
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
