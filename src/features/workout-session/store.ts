import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";
import { dayInSaoPaulo } from "@/lib/domain/day";
import {
  DEFAULT_EXERCISE_TYPE,
  FIELDS,
  toExerciseType,
  toSetType,
  type ExerciseType,
  type SetField,
  type SetType,
} from "@/lib/domain/exercise-types";
import {
  isCountable,
  isWarmup,
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

/** Série de trabalho da última sessão do exercício (métricas ausentes = não usadas pelo tipo). */
export type PreviousSet = { weightKg: number | null; reps: number | null; distanceM?: number | null; durationS?: number | null };

export type SessionSet = SetEntry & {
  id: string;
  prs: PrKind[];
  setType: SetType;
  distanceM: number | null;
  durationS: number | null;
};

/** Campos editáveis de uma série (carga, reps, distância em m, duração em s). */
export type SetPatch = Partial<Pick<SessionSet, "weightKg" | "reps" | "distanceM" | "durationS">>;

export type SessionExercise = {
  /** Vira o id de `workout_exercises` (gerado no aparelho: reenvio idempotente). */
  id: string;
  exerciseId: string;
  name: string;
  /** Define os campos da série (ver `FIELDS`). */
  exerciseType: ExerciseType;
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
  /** Sem tipo (dados antigos), carga × reps. */
  exerciseType?: ExerciseType;
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
  updateSet(exIdx: number, setIdx: number, patch: SetPatch): void;
  /** Alterna a série entre aquecimento e normal (aquecimento não conta para PR nem volume). */
  toggleWarmup(exIdx: number, setIdx: number): void;
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

const emptySet = (): SessionSet => ({
  id: crypto.randomUUID(),
  setType: "normal",
  weightKg: null,
  reps: null,
  distanceM: null,
  durationS: null,
  done: false,
  prs: [],
});

const PATCH_KEY: Record<SetField, keyof SetPatch> = {
  weight: "weightKg",
  reps: "reps",
  distance: "distanceM",
  duration: "durationS",
};

function exerciseFromSeed(seed: ExerciseSeed): SessionExercise {
  return {
    id: crypto.randomUUID(),
    exerciseId: seed.exerciseId,
    name: seed.name,
    exerciseType: seed.exerciseType ?? DEFAULT_EXERCISE_TYPE,
    restSec: seed.restSec,
    notes: seed.notes,
    previous: seed.previous.map((p) => ({ ...p })),
    bests: seed.bests ? { ...seed.bests } : null,
    sets: Array.from({ length: Math.max(1, seed.sets) }, emptySet),
  };
}

/** Recalcula os PRs do exercício inteiro (a ordem das séries importa). */
function withPrs(exercise: SessionExercise): SessionExercise {
  const prs = markSessionPrs(exercise.sets, exercise.bests, exercise.exerciseType);
  return { ...exercise, sets: exercise.sets.map((s, i) => ({ ...s, prs: prs[i] })) };
}

/**
 * O "anterior" da série: as séries de trabalho da última sessão, na ordem. Aquecimento
 * não tem anterior e não desloca a coluna (a 1ª série de trabalho pega o 1º anterior).
 */
export function previousFor(exercise: SessionExercise, setIdx: number): PreviousSet | undefined {
  const set = exercise.sets[setIdx];
  if (!set || isWarmup(set)) return undefined;
  const workingIdx = exercise.sets.slice(0, setIdx).filter((s) => !isWarmup(s)).length;
  return exercise.previous[workingIdx];
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
      sets: e.sets
        .filter((s) => isCountable(s, e.exerciseType))
        .map((s) => {
          // Só os campos do tipo vão ao banco (um valor esquecido noutro campo fica de fora).
          const fields = FIELDS[e.exerciseType];
          const pick = (field: SetField, value: number | null) => (fields.includes(field) ? value : null);
          return {
            id: s.id,
            set_type: s.setType,
            weight_kg: pick("weight", s.weightKg),
            reps: pick("reps", s.reps),
            distance_m: pick("distance", s.distanceM),
            duration_s: pick("duration", s.durationS),
            pr_kinds: s.prs,
          };
        }),
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
  return summarizeSession(
    workout.exercises.map((e) => ({ type: e.exerciseType, sets: e.sets })),
    workout.startedAt,
    finishedAt,
  );
}

export function hasCountableSet(workout: ActiveWorkout): boolean {
  return workout.exercises.some((e) => e.sets.some((s) => isCountable(s, e.exerciseType)));
}

/** Sessão salva por uma versão anterior do app (v1: sem tipos de exercício e de série). */
export function migrateWorkout(workout: ActiveWorkout | null): ActiveWorkout | null {
  if (!workout) return null;
  return {
    ...workout,
    exercises: workout.exercises.map((e) => ({
      ...e,
      exerciseType: toExerciseType(e.exerciseType),
      sets: e.sets.map((s) => ({
        ...s,
        setType: toSetType(s.setType),
        distanceM: s.distanceM ?? null,
        durationS: s.durationS ?? null,
      })),
    })),
  };
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

          toggleWarmup(exIdx, setIdx) {
            updateExercise(exIdx, (e) =>
              withPrs({
                ...e,
                sets: e.sets.map((s, i) =>
                  i === setIdx ? { ...s, setType: s.setType === "warmup" ? "normal" : "warmup" } : s,
                ),
              }),
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

            // Campo vazio usa o anterior (só os campos do tipo do exercício).
            const previous = previousFor(exercise, setIdx);
            const next: SessionSet = { ...current, done: true };
            for (const field of FIELDS[exercise.exerciseType]) {
              const key = PATCH_KEY[field];
              next[key] = current[key] ?? previous?.[key] ?? null;
            }
            if (!isCountable(next, exercise.exerciseType)) return false;

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
              const added: SessionSet = {
                ...emptySet(),
                weightKg: last?.weightKg ?? null,
                reps: last?.reps ?? null,
                distanceM: last?.distanceM ?? null,
                durationS: last?.durationS ?? null,
              };
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
        // v2: tipos de exercício e de série. Sessão em andamento da v1 é migrada, não perdida.
        version: 2,
        migrate: (persisted) => ({
          workout: migrateWorkout((persisted as Partial<State> | undefined)?.workout ?? null),
        }),
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
