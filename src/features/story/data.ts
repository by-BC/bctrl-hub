import type { HistoryDetail } from "@/features/history/api";
import type { WeekSummary } from "@/features/week/api";
import { countsForRecords } from "@/lib/domain/exercise-types";
import { buildStoryData, type StoryData } from "@/lib/domain/story";

/**
 * Do treino gravado (detalhe do histórico) + `week_summary` ao `StoryData` dos layouts.
 * Os layouts desenham carga × reps: aquecimento e séries sem carga e reps (prancha,
 * corrida…) ficam de fora do story.
 */
export function storyDataFrom(workout: HistoryDetail, week: WeekSummary | null): StoryData {
  return buildStoryData(
    {
      routineName: workout.routine?.name ?? null,
      day: workout.day,
      startedAt: workout.started_at,
      finishedAt: workout.finished_at,
      exercises: workout.workout_exercises.map((e) => ({
        name: e.exercise?.name ?? "Exercício",
        sets: e.workout_sets.flatMap((s) =>
          countsForRecords(s) && s.weight_kg !== null && s.reps !== null
            ? [{ weightKg: Number(s.weight_kg), reps: s.reps, prs: s.pr_kinds }]
            : [],
        ),
      })),
    },
    week,
  );
}
