import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { lastDayByExercise, type ExerciseOccurrenceRow, type SessionStatRow } from "@/lib/domain/stats";
import { createClient } from "@/lib/supabase/client";
import { DataError } from "@/features/routines/api";

/**
 * Leituras de evolução (views `v_exercise_session_stats` e `v_exercise_bests`) e o peso
 * corporal. O cliente é parâmetro para os testes de integração usarem um usuário descartável.
 */

type Client = SupabaseClient<Database>;
const db = (): Client => createClient();

export const progressKeys = {
  all: ["progress"] as const,
  overview: () => ["progress", "overview"] as const,
  exercise: (id: string) => ["progress", "exercise", id] as const,
  stats: (id: string) => ["progress", "exercise", id, "stats"] as const,
  history: (id: string) => ["progress", "exercise", id, "history"] as const,
  bodyWeights: () => ["progress", "body-weights"] as const,
};

function fail(error: { message: string; code?: string }, message: string): never {
  console.error("[bctrl]", message, error);
  throw new DataError(message, error.code);
}

export type ExerciseBests = { maxWeight: number; maxSetVolume: number; maxE1rm: number };

export type ProgressOverviewItem = {
  id: string;
  name: string;
  muscle_group: string | null;
  lastDay: string | null;
  maxWeight: number | null;
};

/** Lista de /evolucao: cada exercício com o último dia treinado e a melhor carga. */
export async function fetchProgressOverview(client: Client = db()): Promise<ProgressOverviewItem[]> {
  const [exercises, bests, stats] = await Promise.all([
    client.from("exercises").select("id, name, muscle_group"),
    client.from("v_exercise_bests").select("exercise_id, max_weight"),
    client.from("v_exercise_session_stats").select("exercise_id, day"),
  ]);
  if (exercises.error) fail(exercises.error, "Não foi possível carregar os exercícios.");
  if (bests.error) fail(bests.error, "Não foi possível carregar os recordes.");
  if (stats.error) fail(stats.error, "Não foi possível carregar a evolução.");

  const best = new Map(bests.data.map((b) => [b.exercise_id, b.max_weight === null ? null : Number(b.max_weight)]));
  const last = lastDayByExercise(stats.data);
  return exercises.data.map((e) => ({
    ...e,
    lastDay: last.get(e.id) ?? null,
    maxWeight: best.get(e.id) ?? null,
  }));
}

export type ExerciseOverview = { id: string; name: string; muscle_group: string | null; bests: ExerciseBests | null };

/** Nome e recordes do exercício (`null` se não existe ou não é do usuário). */
export async function fetchExercise(id: string, client: Client = db()): Promise<ExerciseOverview | null> {
  const [exercise, bests] = await Promise.all([
    client.from("exercises").select("id, name, muscle_group").eq("id", id).maybeSingle(),
    client
      .from("v_exercise_bests")
      .select("max_weight, max_set_volume, max_e1rm")
      .eq("exercise_id", id)
      .maybeSingle(),
  ]);
  if (exercise.error) fail(exercise.error, "Não foi possível carregar o exercício.");
  if (bests.error) fail(bests.error, "Não foi possível carregar os recordes.");
  if (!exercise.data) return null;
  const b = bests.data;
  return {
    ...exercise.data,
    bests:
      b && b.max_weight !== null
        ? { maxWeight: Number(b.max_weight), maxSetVolume: Number(b.max_set_volume ?? 0), maxE1rm: Number(b.max_e1rm ?? 0) }
        : null,
  };
}

/** Uma linha por treino: melhor carga, melhor e1RM e volume (a série do gráfico). */
export async function fetchExerciseStats(id: string, client: Client = db()): Promise<SessionStatRow[]> {
  const { data, error } = await client
    .from("v_exercise_session_stats")
    .select("workout_id, day, started_at, best_weight, best_e1rm, volume, sets")
    .eq("exercise_id", id)
    .order("day")
    .order("started_at");
  if (error) fail(error, "Não foi possível carregar a evolução do exercício.");
  return data;
}

/** Séries do exercício em cada treino finalizado (histórico e recordes). */
export async function fetchExerciseHistory(id: string, client: Client = db()): Promise<ExerciseOccurrenceRow[]> {
  const { data, error } = await client
    .from("workout_exercises")
    .select(
      "id, position, workout:workouts!inner(id, day, started_at, finished_at, routine:routines(name)), workout_sets(id, position, weight_kg, reps, pr_kinds)",
    )
    .eq("exercise_id", id)
    .not("workout.finished_at", "is", null);
  if (error) fail(error, "Não foi possível carregar o histórico do exercício.");
  return data;
}

// ── Peso corporal ─────────────────────────────────────────────────────────

export type BodyWeight = { day: string; weight_kg: number };

export async function fetchBodyWeights(client: Client = db()): Promise<BodyWeight[]> {
  const { data, error } = await client.from("body_weights").select("day, weight_kg").order("day");
  if (error) fail(error, "Não foi possível carregar o peso corporal.");
  return data.map((r) => ({ day: r.day, weight_kg: Number(r.weight_kg) }));
}

/**
 * Um registro por dia: grava ou substitui o peso do dia. A chave natural `(user_id, day)`
 * é a chave de idempotência (reenviar a mesma gravação dá no mesmo registro).
 */
export async function upsertBodyWeight(entry: BodyWeight, client: Client = db()) {
  const { error } = await client
    .from("body_weights")
    .upsert(entry, { onConflict: "user_id,day", defaultToNull: false });
  if (error) fail(error, "Não foi possível salvar o peso.");
}

export async function deleteBodyWeight(day: string, client: Client = db()) {
  const { error } = await client.from("body_weights").delete().eq("day", day);
  if (error) fail(error, "Não foi possível excluir o peso.");
}
