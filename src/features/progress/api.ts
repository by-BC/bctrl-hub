import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { toExerciseType, type ExerciseType } from "@/lib/domain/exercise-types";
import { lastDayByExercise, type ExerciseOccurrenceRow, type SessionStatRow } from "@/lib/domain/stats";
import type { Bests } from "@/lib/domain/workout";
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

/** Recordes de todos os tempos (só as métricas que o exercício já registrou). */
export type ExerciseBests = Bests;

type BestsRow = {
  max_weight: number | null;
  max_set_volume: number | null;
  max_e1rm: number | null;
  max_duration_s: number | null;
  max_distance_m: number | null;
};

const BESTS_COLUMNS = "max_weight, max_set_volume, max_e1rm, max_duration_s, max_distance_m";

/** Linha de `v_exercise_bests` → recordes, sem as métricas vazias; nenhuma → `null`. */
function toBests(row: BestsRow | null): ExerciseBests | null {
  if (!row) return null;
  const entries = Object.entries({
    maxWeight: row.max_weight,
    maxSetVolume: row.max_set_volume,
    maxE1rm: row.max_e1rm,
    maxDurationS: row.max_duration_s,
    maxDistanceM: row.max_distance_m,
  }).filter(([, v]) => v !== null);
  return entries.length > 0 ? Object.fromEntries(entries.map(([k, v]) => [k, Number(v)])) : null;
}

export type ProgressOverviewItem = {
  id: string;
  name: string;
  muscle_group: string | null;
  exerciseType: ExerciseType;
  lastDay: string | null;
  maxWeight: number | null;
  bests: ExerciseBests | null;
};

/** Lista de /evolucao: cada exercício com o último dia treinado e a melhor marca. */
export async function fetchProgressOverview(client: Client = db()): Promise<ProgressOverviewItem[]> {
  const [exercises, bests, stats] = await Promise.all([
    client.from("exercises").select("id, name, muscle_group, exercise_type"),
    client.from("v_exercise_bests").select(`exercise_id, ${BESTS_COLUMNS}`),
    client.from("v_exercise_session_stats").select("exercise_id, day"),
  ]);
  if (exercises.error) fail(exercises.error, "Não foi possível carregar os exercícios.");
  if (bests.error) fail(bests.error, "Não foi possível carregar os recordes.");
  if (stats.error) fail(stats.error, "Não foi possível carregar a evolução.");

  const best = new Map(bests.data.map((b) => [b.exercise_id, toBests(b)]));
  const last = lastDayByExercise(stats.data);
  return exercises.data.map(({ exercise_type, ...e }) => {
    const b = best.get(e.id) ?? null;
    return {
      ...e,
      exerciseType: toExerciseType(exercise_type),
      lastDay: last.get(e.id) ?? null,
      maxWeight: b?.maxWeight ?? null,
      bests: b,
    };
  });
}

export type ExerciseOverview = {
  id: string;
  name: string;
  muscle_group: string | null;
  exercise_type: ExerciseType;
  bests: ExerciseBests | null;
};

/** Nome, tipo e recordes do exercício (`null` se não existe ou não é do usuário). */
export async function fetchExercise(id: string, client: Client = db()): Promise<ExerciseOverview | null> {
  const [exercise, bests] = await Promise.all([
    client.from("exercises").select("id, name, muscle_group, exercise_type").eq("id", id).maybeSingle(),
    client.from("v_exercise_bests").select(BESTS_COLUMNS).eq("exercise_id", id).maybeSingle(),
  ]);
  if (exercise.error) fail(exercise.error, "Não foi possível carregar o exercício.");
  if (bests.error) fail(bests.error, "Não foi possível carregar os recordes.");
  if (!exercise.data) return null;
  return {
    ...exercise.data,
    exercise_type: toExerciseType(exercise.data.exercise_type),
    bests: toBests(bests.data),
  };
}

/** Uma linha por treino: melhor carga, melhor e1RM e volume (a série do gráfico). */
export async function fetchExerciseStats(id: string, client: Client = db()): Promise<SessionStatRow[]> {
  const { data, error } = await client
    .from("v_exercise_session_stats")
    .select("workout_id, day, started_at, best_weight, best_e1rm, volume, sets, best_duration_s, best_distance_m")
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
      "id, position, workout:workouts!inner(id, day, started_at, finished_at, routine:routines(name)), workout_sets(id, position, set_type, weight_kg, reps, distance_m, duration_s, pr_kinds)",
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
