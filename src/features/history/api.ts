import type { Tables, TablesUpdate } from "@/lib/database.types";
import { DataError } from "@/features/routines/api";
import { createClient } from "@/lib/supabase/client";

/** Histórico de treinos finalizados (supabase-js direto, protegido por RLS). */

export const historyKeys = {
  all: ["history"] as const,
  list: () => ["history", "list"] as const,
  detail: (id: string) => ["history", "detail", id] as const,
};

type SetRow = Pick<Tables<"workout_sets">, "id" | "position" | "weight_kg" | "reps" | "pr_kinds">;

export type HistoryListItem = Pick<Tables<"workouts">, "id" | "day" | "started_at" | "finished_at"> & {
  routine: { name: string } | null;
  workout_exercises: { id: string; workout_sets: Pick<SetRow, "weight_kg" | "reps" | "pr_kinds">[] }[];
};

export type HistoryExercise = Pick<Tables<"workout_exercises">, "id" | "position" | "exercise_id"> & {
  exercise: { name: string } | null;
  workout_sets: SetRow[];
};

export type HistoryDetail = Pick<Tables<"workouts">, "id" | "day" | "started_at" | "finished_at" | "routine_id"> & {
  routine: { name: string } | null;
  workout_exercises: HistoryExercise[];
};

function fail(error: { message: string; code?: string }, message: string): never {
  console.error("[bctrl]", message, error);
  throw new DataError(message, error.code);
}

const db = () => createClient();

export async function fetchHistory(): Promise<HistoryListItem[]> {
  const { data, error } = await db()
    .from("workouts")
    .select("id, day, started_at, finished_at, routine:routines(name), workout_exercises(id, workout_sets(weight_kg, reps, pr_kinds))")
    .not("finished_at", "is", null)
    .order("started_at", { ascending: false })
    .limit(200);
  if (error) fail(error, "Não foi possível carregar o histórico.");
  return data;
}

export async function fetchWorkoutDetail(id: string): Promise<HistoryDetail | null> {
  const { data, error } = await db()
    .from("workouts")
    .select(
      "id, day, started_at, finished_at, routine_id, routine:routines(name), workout_exercises(id, position, exercise_id, exercise:exercises(name), workout_sets(id, position, weight_kg, reps, pr_kinds))",
    )
    .eq("id", id)
    .order("position", { referencedTable: "workout_exercises" })
    .order("position", { referencedTable: "workout_exercises.workout_sets" })
    .maybeSingle();
  if (error) fail(error, "Não foi possível carregar o treino.");
  return data;
}

export async function updateWorkoutSet(id: string, patch: Pick<TablesUpdate<"workout_sets">, "weight_kg" | "reps">) {
  const { error } = await db().from("workout_sets").update(patch).eq("id", id);
  if (error) fail(error, "Não foi possível salvar a série.");
}

/** Apaga o treino; exercícios e séries vão junto (cascata). */
export async function deleteWorkout(id: string) {
  const { error } = await db().from("workouts").delete().eq("id", id);
  if (error) fail(error, "Não foi possível excluir o treino.");
}
