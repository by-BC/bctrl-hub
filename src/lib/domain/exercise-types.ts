/**
 * Tipos de exercício (os 8 do Hevy) e de série. Sem I/O.
 * Cada tipo define quais campos a série usa e quais recordes ela pode bater.
 * Espelha os checks de `exercises.exercise_type` e `workout_sets.set_type` no banco.
 */

export const EXERCISE_TYPES = [
  "weight_reps",
  "reps_only",
  "bodyweight_reps",
  "bodyweight_assisted_reps",
  "duration",
  "weight_duration",
  "distance_duration",
  "short_distance_weight",
] as const;
export type ExerciseType = (typeof EXERCISE_TYPES)[number];

export const DEFAULT_EXERCISE_TYPE: ExerciseType = "weight_reps";

export const SET_TYPES = ["normal", "warmup", "failure", "dropset"] as const;
export type SetType = (typeof SET_TYPES)[number];

export const SET_TYPE_LABEL: Record<SetType, string> = {
  normal: "Normal",
  warmup: "Aquecimento",
  failure: "Até a falha",
  dropset: "Drop set",
};

export type SetField = "weight" | "reps" | "distance" | "duration";

/** Campos da série, na ordem em que aparecem na tela. */
export const FIELDS: Record<ExerciseType, readonly SetField[]> = {
  weight_reps: ["weight", "reps"],
  reps_only: ["reps"],
  bodyweight_reps: ["weight", "reps"], // carga extra (opcional)
  bodyweight_assisted_reps: ["weight", "reps"], // carga de assistência (opcional)
  duration: ["duration"],
  weight_duration: ["weight", "duration"],
  distance_duration: ["distance", "duration"],
  short_distance_weight: ["weight", "distance"],
};

/**
 * Campos sem os quais a série não pode ser concluída. Além deles, a série precisa de
 * pelo menos um campo do tipo preenchido (em `distance_duration`, basta um dos dois).
 */
export const REQUIRED: Record<ExerciseType, readonly SetField[]> = {
  weight_reps: ["weight", "reps"],
  reps_only: ["reps"],
  bodyweight_reps: ["reps"],
  bodyweight_assisted_reps: ["reps"],
  duration: ["duration"],
  weight_duration: ["duration"],
  distance_duration: [],
  short_distance_weight: ["distance"],
};

export const PR_KINDS = ["weight", "volume", "e1rm", "duration", "distance"] as const;
export type PrKind = (typeof PR_KINDS)[number];

/**
 * Recordes que cada tipo pode bater. Assistido fica sem recorde de carga (menos
 * assistência é que seria o progresso); só reps também não tem recorde nesta versão.
 */
export const RECORD_KINDS: Record<ExerciseType, readonly PrKind[]> = {
  weight_reps: ["weight", "volume", "e1rm"],
  reps_only: [],
  bodyweight_reps: ["weight", "volume", "e1rm"],
  bodyweight_assisted_reps: [],
  duration: ["duration"],
  weight_duration: ["duration"],
  distance_duration: ["distance"],
  short_distance_weight: ["distance"],
};

export const toExerciseType = (value: string | null | undefined): ExerciseType =>
  (EXERCISE_TYPES as readonly string[]).includes(value ?? "") ? (value as ExerciseType) : DEFAULT_EXERCISE_TYPE;

export const toSetType = (value: string | null | undefined): SetType =>
  (SET_TYPES as readonly string[]).includes(value ?? "") ? (value as SetType) : "normal";

export const isPrKind = (value: string): value is PrKind => (PR_KINDS as readonly string[]).includes(value);

/** Aquecimento não conta para recordes nem volume (nem no banco: ver as views). */
export const countsForRecords = (s: { set_type?: string | null }) => s.set_type !== "warmup";

export type SetMetrics = {
  weightKg: number | null;
  reps: number | null;
  distanceM?: number | null;
  durationS?: number | null;
};

export function fieldValue(set: SetMetrics, field: SetField): number | null {
  if (field === "weight") return set.weightKg;
  if (field === "reps") return set.reps;
  if (field === "distance") return set.distanceM ?? null;
  return set.durationS ?? null;
}

/** Valor aceito pelo banco: carga ≥ 0, reps inteiras ≥ 1, distância > 0, duração inteira > 0. */
export function isValidValue(field: SetField, value: number): boolean {
  if (!Number.isFinite(value)) return false;
  if (field === "weight") return value >= 0;
  if (field === "reps" || field === "duration") return Number.isInteger(value) && value >= 1;
  return value > 0;
}

/** A série tem o mínimo do tipo, e nada inválido nos campos do tipo. */
export function isSetComplete(type: ExerciseType, set: SetMetrics): boolean {
  let filled = 0;
  for (const field of FIELDS[type]) {
    const value = fieldValue(set, field);
    if (value === null) {
      if (REQUIRED[type].includes(field)) return false;
      continue;
    }
    if (!isValidValue(field, value)) return false;
    filled += 1;
  }
  return filled > 0;
}

/** Carga, volume e 1RM só existem com carga e reps. */
export const hasLoadAndReps = (set: SetMetrics) => set.weightKg !== null && set.reps !== null;
