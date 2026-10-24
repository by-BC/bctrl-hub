import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/database.types";
import { toExerciseType } from "@/lib/domain/exercise-types";
import type { Bests } from "@/lib/domain/workout";
import type { FinishWorkoutInput } from "@/features/workout-session/schemas/workout";
import { REST_DEFAULT } from "@/features/routines/schemas/routine";
import { createClient } from "@/lib/supabase/client";
import { DataError } from "@/features/routines/api";
import { SyncError, type ExerciseSeed, type PreviousSet, type SessionSeed } from "./store";

/**
 * Leituras de início de sessão e o envio final (`finish_workout`).
 * O cliente é parâmetro para os testes de integração usarem um usuário descartável.
 */

type Client = SupabaseClient<Database>;
const db = (): Client => createClient();

export const workoutKeys = {
  all: ["workouts"] as const,
  lastFinished: () => ["workouts", "last-finished"] as const,
};

export type ExerciseHistory = { previous: PreviousSet[]; bests: Bests | null };

function fail(error: { message: string; code?: string }, message: string): never {
  console.error("[bctrl]", message, error);
  throw new DataError(message, error.code);
}

/** Anterior (`v_exercise_last_sets`) e recordes (`v_exercise_bests`) de cada exercício. */
export async function fetchExerciseHistory(
  exerciseIds: readonly string[],
  client: Client = db(),
): Promise<Map<string, ExerciseHistory>> {
  const ids = [...new Set(exerciseIds)];
  const history = new Map<string, ExerciseHistory>(ids.map((id) => [id, { previous: [], bests: null }]));
  if (ids.length === 0) return history;

  const [last, bests] = await Promise.all([
    client
      .from("v_exercise_last_sets")
      .select("exercise_id, position, weight_kg, reps, distance_m, duration_s")
      .in("exercise_id", ids)
      .order("position"),
    client
      .from("v_exercise_bests")
      .select("exercise_id, max_weight, max_set_volume, max_e1rm, max_duration_s, max_distance_m")
      .in("exercise_id", ids),
  ]);
  if (last.error) fail(last.error, "Não foi possível carregar o treino anterior.");
  if (bests.error) fail(bests.error, "Não foi possível carregar os recordes.");

  for (const row of last.data) {
    if (!row.exercise_id) continue;
    history.get(row.exercise_id)?.previous.push({
      weightKg: toNumber(row.weight_kg),
      reps: row.reps,
      ...present({ distanceM: row.distance_m, durationS: row.duration_s }),
    });
  }
  for (const row of bests.data) {
    const entry = row.exercise_id ? history.get(row.exercise_id) : undefined;
    if (!entry) continue;
    const found = present({
      maxWeight: row.max_weight,
      maxSetVolume: row.max_set_volume,
      maxE1rm: row.max_e1rm,
      maxDurationS: row.max_duration_s,
      maxDistanceM: row.max_distance_m,
    });
    entry.bests = Object.keys(found).length > 0 ? found : null;
  }
  return history;
}

const toNumber = (value: number | string | null) => (value === null ? null : Number(value));

/** Só as métricas preenchidas, como número (numeric chega do PostgREST como número ou texto). */
function present<K extends string>(values: Record<K, number | string | null>): Partial<Record<K, number>> {
  const out: Partial<Record<K, number>> = {};
  for (const key of Object.keys(values) as K[]) {
    if (values[key] !== null) out[key] = Number(values[key]);
  }
  return out;
}

/** Tudo o que a sessão precisa da rotina, já com o anterior e os recordes (para seguir sem rede). */
export async function fetchSessionSeed(routineId: string | null, client: Client = db()): Promise<SessionSeed> {
  if (!routineId) return { routineId: null, routineName: null, exercises: [] };

  const { data: routine, error } = await client
    .from("routines")
    .select("id, name, rest_sec, routine_exercises(exercise_id, position, sets, rest_sec, notes, exercise:exercises(name, notes, exercise_type))")
    .eq("id", routineId)
    .order("position", { referencedTable: "routine_exercises" })
    .maybeSingle();
  if (error) fail(error, "Não foi possível carregar a rotina.");
  if (!routine) throw new DataError("Rotina não encontrada.");

  const history = await fetchExerciseHistory(
    routine.routine_exercises.map((i) => i.exercise_id),
    client,
  );
  const exercises: ExerciseSeed[] = routine.routine_exercises.map((item) => ({
    exerciseId: item.exercise_id,
    name: item.exercise?.name ?? "Exercício",
    exerciseType: toExerciseType(item.exercise?.exercise_type),
    restSec: item.rest_sec ?? routine.rest_sec,
    notes: item.notes?.trim() || item.exercise?.notes?.trim() || null,
    sets: item.sets,
    ...history.get(item.exercise_id)!,
  }));
  return { routineId: routine.id, routineName: routine.name, exercises };
}

/**
 * Exercício adicionado durante a sessão. Sem rede, entra sem anterior nem recordes
 * (e, se o seletor não trouxe o tipo, como carga × reps).
 */
export async function fetchExerciseSeed(
  exercise: { id: string; name: string; exercise_type?: string | null },
  restSec = REST_DEFAULT,
  client: Client = db(),
): Promise<ExerciseSeed> {
  let history: ExerciseHistory = { previous: [], bests: null };
  let type = exercise.exercise_type;
  try {
    const [found, row] = await Promise.all([
      fetchExerciseHistory([exercise.id], client),
      type ? null : client.from("exercises").select("exercise_type").eq("id", exercise.id).maybeSingle(),
    ]);
    history = found.get(exercise.id) ?? history;
    type ??= row?.data?.exercise_type;
  } catch {
    // Offline na academia: segue sem o histórico.
  }
  return {
    exerciseId: exercise.id,
    name: exercise.name,
    exerciseType: toExerciseType(type),
    restSec,
    notes: null,
    sets: 3,
    ...history,
  };
}

/** Rotina da última sessão finalizada (base do treino sugerido). */
export async function fetchLastFinishedRoutineId(client: Client = db()): Promise<string | null> {
  const { data, error } = await client
    .from("workouts")
    .select("routine_id")
    .not("finished_at", "is", null)
    .order("finished_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) fail(error, "Não foi possível carregar o último treino.");
  return data?.routine_id ?? null;
}

/**
 * Grava o treino (`finish_workout`, idempotente pelo id).
 * Falha de rede (sem código) ou 5xx vira `SyncError` com reenvio automático; erro do banco não.
 */
export async function sendWorkout(payload: FinishWorkoutInput, client: Client = db()): Promise<string> {
  let result: Awaited<ReturnType<typeof callFinish>>;
  try {
    result = await callFinish(client, payload);
  } catch {
    throw new SyncError("Sem conexão. O treino está salvo no aparelho.", true);
  }
  const { data, error, status } = result;
  if (error) {
    const network = !error.code || status === 0 || status >= 500;
    if (network) throw new SyncError("Sem conexão. O treino está salvo no aparelho.", true);
    console.error("[bctrl] finish_workout", error);
    const message =
      error.code === "42501" || status === 401
        ? "Sua sessão expirou. Entre de novo para enviar o treino."
        : "O servidor recusou o treino. Tente de novo.";
    throw new SyncError(message, false);
  }
  return data ?? payload.id;
}

function callFinish(client: Client, payload: FinishWorkoutInput) {
  return client.rpc("finish_workout", { payload: payload as unknown as Json });
}
