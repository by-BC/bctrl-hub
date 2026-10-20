import { toExerciseType, toSetType, isPrKind } from "@/lib/domain/exercise-types";
import { summarizeSession, type SessionSummary } from "@/lib/domain/workout";

type DbSet = {
  set_type?: string | null;
  weight_kg: number | null;
  reps: number | null;
  distance_m?: number | null;
  duration_s?: number | null;
  pr_kinds: string[];
};

const num = (v: number | null | undefined) => (v === null || v === undefined ? null : Number(v));

/** Resumo (duração, volume, séries, PRs) de um treino gravado. Aquecimento fica de fora. */
export function summarizeStored(workout: {
  started_at: string;
  finished_at: string | null;
  workout_exercises: { exercise?: { exercise_type: string } | null; workout_sets: DbSet[] }[];
}): SessionSummary {
  return summarizeSession(
    workout.workout_exercises.map((e) => ({
      type: toExerciseType(e.exercise?.exercise_type),
      sets: e.workout_sets.map((s) => ({
        setType: toSetType(s.set_type),
        weightKg: num(s.weight_kg),
        reps: s.reps,
        distanceM: num(s.distance_m),
        durationS: s.duration_s ?? null,
        done: true,
        prs: s.pr_kinds.filter(isPrKind),
      })),
    })),
    workout.started_at,
    workout.finished_at ?? workout.started_at,
  );
}
