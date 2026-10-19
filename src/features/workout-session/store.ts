import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";
import { dayInSaoPaulo } from "@/lib/domain/day";
import {
  isCountable,
  markSessionPrs,
  summarizeSession,
  type Bests,
  type PrKind,
  type SessionSummary,
  type SetEntry,
} from "@/lib/domain/workout";
import { finishWorkoutSchema, type FinishWorkoutPayload } from "@/lib/schemas/workout";

/**
 * Sessão de treino ativa: vive só no aparelho (localStorage) até o `finish_workout`.
 * Nenhuma escrita no banco durante o treino; o anterior e os recordes de cada exercício
 * são guardados no início para funcionar sem rede.
 */

export const ACTIVE_WORKOUT_STORAGE_KEY = "bctrl.activeWorkout";

export type PreviousSet = { weightKg: number; reps: number };
export type SessionSet = SetEntry & { id: string; prs: PrKind[] };

export type SessionExercise = {
  /** Vira o id de `workout_exercises` (gerado no aparelho: reenvio idempotente). */
  id: string;
  exerciseId: string;
  name: string;
  restSec: number;
  notes: string | null;
  previous: PreviousSet[];
  bests: Bests | null;
  sets: SessionSet[];
};

export type SyncState = { attempts: number; retryable: boolean; error: string | null; lastAttemptAt: string };

export type ActiveWorkout = {
  id: string;
  routineId: string | null;
  routineName: string | null;
  startedAt: string;
  exercises: SessionExercise[];
  /** Timer por timestamp: continua certo após reload ou com a tela bloqueada. */
  rest: { endsAt: string; durationSec: number } | null;
  status: "active" | "pendingSync";
  finishedAt: string | null;
  sync: SyncState | null;
};

/** O que a sessão precisa saber de um exercício ao entrar (da rotina ou adicionado na hora). */
export type ExerciseSeed = {
  exerciseId: string;
  name: string;
  restSec: number;
  notes: string | null;
  sets: number;
  previous: PreviousSet[];
  bests: Bests | null;
};

export type SessionSeed = { routineId: string | null; routineName: string | null; exercises: ExerciseSeed[] };

/** Envia o payload ao banco e devolve o id gravado. */
export type SendWorkout = (payload: FinishWorkoutPayload) => Promise<string>;

export type FinishResult =
  | { status: "synced"; workoutId: string; summary: SessionSummary }
  | { status: "pending"; summary: SessionSummary; error: string; retryable: boolean };

/** Falha ao gravar. `retryable` = vale tentar de novo sozinho (rede); erro do banco não. */
export class SyncError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = "SyncError";
  }
}

export class NothingToFinishError extends Error {
  constructor() {
    super("Conclua ao menos uma série para finalizar o treino.");
    this.name = "NothingToFinishError";
  }
}

type State = { workout: ActiveWorkout | null };

type Actions = {
  start(seed: SessionSeed, now?: Date): void;
  updateSet(exIdx: number, setIdx: number, patch: Partial<Pick<SetEntry, "weightKg" | "reps">>): void;
  /** Alterna a série. Ao concluir, usa o anterior se faltar valor e inicia o descanso. */
  completeSet(exIdx: number, setIdx: number, now?: number): boolean;
  addSet(exIdx: number): void;
  removeSet(exIdx: number, setIdx: number): void;
  addExercise(seed: ExerciseSeed): void;
  removeExercise(exIdx: number): void;
  adjustRest(deltaSec: number, now?: number): void;
  skipRest(): void;
  /** Marca como finalizada (pendingSync) e tenta gravar; só limpa após o servidor confirmar. */
  finish(send: SendWorkout, now?: Date): Promise<FinishResult>;
  retrySync(send: SendWorkout): Promise<FinishResult>;
  discard(): void;
};

export type ActiveWorkoutStore = State & Actions;

const emptySet = (): SessionSet => ({ id: crypto.randomUUID(), weightKg: null, reps: null, done: false, prs: [] });

function exerciseFromSeed(seed: ExerciseSeed): SessionExercise {
  return {
    id: crypto.randomUUID(),
    exerciseId: seed.exerciseId,
    name: seed.name,
    restSec: seed.restSec,
    notes: seed.notes,
    previous: seed.previous.map((p) => ({ ...p })),
    bests: seed.bests ? { ...seed.bests } : null,
    sets: Array.from({ length: Math.max(1, seed.sets) }, emptySet),
  };
}

/** Recalcula os PRs do exercício inteiro (a ordem das séries importa). */
function withPrs(exercise: SessionExercise): SessionExercise {
  const prs = markSessionPrs(exercise.sets, exercise.bests);
  return { ...exercise, sets: exercise.sets.map((s, i) => ({ ...s, prs: prs[i] })) };
}

function finishedAtOf(workout: ActiveWorkout): string {
  return workout.finishedAt ?? new Date().toISOString();
}

/** Payload validado do `finish_workout`: só séries que contam; exercício sem nenhuma fica de fora. */
export function toFinishPayload(workout: ActiveWorkout, finishedAt = finishedAtOf(workout)): FinishWorkoutPayload {
  const exercises = workout.exercises
    .map((e) => ({
      id: e.id,
      exercise_id: e.exerciseId,
      notes: null,
      sets: e.sets.filter(isCountable).map((s) => ({
        id: s.id,
        weight_kg: s.weightKg!,
        reps: s.reps!,
        pr_kinds: s.prs,
      })),
    }))
    .filter((e) => e.sets.length > 0);

  return finishWorkoutSchema.parse({
    id: workout.id,
    routine_id: workout.routineId,
    started_at: workout.startedAt,
    finished_at: finishedAt,
    day: dayInSaoPaulo(workout.startedAt),
    notes: null,
    exercises,
  });
}

export function summaryOf(workout: ActiveWorkout, finishedAt = finishedAtOf(workout)): SessionSummary {
  return summarizeSession(workout.exercises, workout.startedAt, finishedAt);
}

export function hasCountableSet(workout: ActiveWorkout): boolean {
  return workout.exercises.some((e) => e.sets.some(isCountable));
}

function errorInfo(error: unknown): { message: string; retryable: boolean } {
  if (error instanceof SyncError) return { message: error.message, retryable: error.retryable };
  return { message: "Não foi possível salvar o treino.", retryable: true };
}

type StoreOptions = { storage?: StateStorage; skipHydration?: boolean };

export function createActiveWorkoutStore({ storage, skipHydration = true }: StoreOptions = {}) {
  // Uma gravação por vez: o evento `online` e o backoff podem disparar juntos.
  let inFlight: Promise<FinishResult> | null = null;

  return create<ActiveWorkoutStore>()(
    persist(
      (set, get) => {
        const updateWorkout = (fn: (w: ActiveWorkout) => ActiveWorkout | null) =>
          set((state) => (state.workout ? { workout: fn(state.workout) } : state));

        const updateExercise = (exIdx: number, fn: (e: SessionExercise) => SessionExercise) =>
          updateWorkout((w) =>
            w.exercises[exIdx] ? { ...w, exercises: w.exercises.map((e, i) => (i === exIdx ? fn(e) : e)) } : w,
          );

        const sync = (send: SendWorkout): Promise<FinishResult> => {
          if (inFlight) return inFlight;
          const workout = get().workout;
          if (!workout || workout.status !== "pendingSync") {
            return Promise.reject(new Error("Nenhum treino aguardando envio."));
          }
          const summary = summaryOf(workout);
          inFlight = (async (): Promise<FinishResult> => {
            try {
              const workoutId = await send(toFinishPayload(workout));
              // Só limpa se ainda for o mesmo treino (nada mudou enquanto enviava).
              if (get().workout?.id === workout.id) set({ workout: null });
              return { status: "synced", workoutId, summary };
            } catch (error) {
              const { message, retryable } = errorInfo(error);
              updateWorkout((w) =>
                w.id === workout.id
                  ? {
                      ...w,
                      sync: {
                        attempts: (w.sync?.attempts ?? 0) + 1,
                        retryable,
                        error: message,
                        lastAttemptAt: new Date().toISOString(),
                      },
                    }
                  : w,
              );
              return { status: "pending", summary, error: message, retryable };
            } finally {
              inFlight = null;
            }
          })();
          return inFlight;
        };

        return {
          workout: null,

          start(seed, now = new Date()) {
            if (get().workout) return;
            set({
              workout: {
                id: crypto.randomUUID(),
                routineId: seed.routineId,
                routineName: seed.routineName,
                startedAt: now.toISOString(),
                exercises: seed.exercises.map(exerciseFromSeed),
                rest: null,
                status: "active",
                finishedAt: null,
                sync: null,
              },
            });
          },

          updateSet(exIdx, setIdx, patch) {
            updateExercise(exIdx, (e) =>
              withPrs({ ...e, sets: e.sets.map((s, i) => (i === setIdx ? { ...s, ...patch } : s)) }),
            );
          },

          completeSet(exIdx, setIdx, now = Date.now()) {
            const exercise = get().workout?.exercises[exIdx];
            const current = exercise?.sets[setIdx];
            if (!exercise || !current) return false;

            if (current.done) {
              updateExercise(exIdx, (e) =>
                withPrs({ ...e, sets: e.sets.map((s, i) => (i === setIdx ? { ...s, done: false } : s)) }),
              );
              return false;
            }

            const previous = exercise.previous[setIdx];
            const next: SessionSet = {
              ...current,
              weightKg: current.weightKg ?? previous?.weightKg ?? null,
              reps: current.reps ?? previous?.reps ?? null,
              done: true,
            };
            if (!isCountable(next)) return false;

            updateExercise(exIdx, (e) => withPrs({ ...e, sets: e.sets.map((s, i) => (i === setIdx ? next : s)) }));
            updateWorkout((w) => ({
              ...w,
              rest:
                exercise.restSec > 0
                  ? { endsAt: new Date(now + exercise.restSec * 1000).toISOString(), durationSec: exercise.restSec }
                  : null,
            }));
            return true;
          },

          addSet(exIdx) {
            updateExercise(exIdx, (e) => {
              const last = e.sets.at(-1);
              const added: SessionSet = { ...emptySet(), weightKg: last?.weightKg ?? null, reps: last?.reps ?? null };
              return { ...e, sets: [...e.sets, added] };
            });
          },

          removeSet(exIdx, setIdx) {
            updateExercise(exIdx, (e) => withPrs({ ...e, sets: e.sets.filter((_, i) => i !== setIdx) }));
          },

          addExercise(seed) {
            updateWorkout((w) => ({ ...w, exercises: [...w.exercises, exerciseFromSeed(seed)] }));
          },

          removeExercise(exIdx) {
            updateWorkout((w) => ({ ...w, exercises: w.exercises.filter((_, i) => i !== exIdx) }));
          },

          adjustRest(deltaSec, now = Date.now()) {
            updateWorkout((w) => {
              if (!w.rest) return w;
              const endsAt = Date.parse(w.rest.endsAt) + deltaSec * 1000;
              if (endsAt <= now) return { ...w, rest: null };
              return {
                ...w,
                rest: { endsAt: new Date(endsAt).toISOString(), durationSec: Math.max(1, w.rest.durationSec + deltaSec) },
              };
            });
          },

          skipRest() {
            updateWorkout((w) => ({ ...w, rest: null }));
          },

          async finish(send, now = new Date()) {
            const workout = get().workout;
            if (!workout) throw new Error("Nenhum treino em andamento.");
            if (workout.status === "active") {
              if (!hasCountableSet(workout)) throw new NothingToFinishError();
              const finishedAt = now.toISOString();
              // Valida antes de marcar: payload inválido não vira pendência eterna.
              toFinishPayload(workout, finishedAt);
              updateWorkout((w) => ({ ...w, status: "pendingSync", finishedAt, rest: null, sync: null }));
            }
            return sync(send);
          },

          retrySync(send) {
            return sync(send);
          },

          discard() {
            set({ workout: null });
          },
        };
      },
      {
        name: ACTIVE_WORKOUT_STORAGE_KEY,
        version: 1,
        storage: createJSONStorage(() => storage ?? localStorage),
        partialize: (state) => ({ workout: state.workout }),
        // Reidratação no cliente (WorkoutSessionProvider): o HTML do servidor não conhece o localStorage.
        skipHydration,
      },
    ),
  );
}

/** Store da sessão ativa do app. */
export const useActiveWorkout = createActiveWorkoutStore();
