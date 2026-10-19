import { summarizeSession, type PrKind, type SessionSummary } from "@/lib/domain/workout";

type DbSet = { weight_kg: number; reps: number; pr_kinds: string[] };

/** Resumo (duração, volume, séries, PRs) de um treino gravado. */
export function summarizeStored(
  workout: { started_at: string; finished_at: string | null; workout_exercises: { workout_sets: DbSet[] }[] },
): SessionSummary {
  return summarizeSession(
    workout.workout_exercises.map((e) => ({
      sets: e.workout_sets.map((s) => ({
        weightKg: Number(s.weight_kg),
        reps: s.reps,
        done: true,
        prs: s.pr_kinds as PrKind[],
      })),
    })),
    workout.started_at,
    workout.finished_at ?? workout.started_at,
  );
}
