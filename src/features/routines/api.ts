import type { PostgrestError } from "@supabase/supabase-js";
import type { Tables, TablesInsert, TablesUpdate } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/client";

/**
 * Acesso a dados de rotinas e exercícios (supabase-js direto, protegido por RLS).
 * Sem React: os hooks em `hooks.ts` cuidam de cache, otimismo e erros.
 */

export type Routine = Tables<"routines">;
export type Exercise = Tables<"exercises">;
export type RoutineExercise = Tables<"routine_exercises">;
export type ExerciseSummary = Pick<Exercise, "id" | "name" | "muscle_group">;

export type RoutineListItem = Routine & { routine_exercises: Pick<RoutineExercise, "id" | "sets">[] };
export type RoutineItem = RoutineExercise & { exercise: ExerciseSummary };
export type RoutineDetail = Routine & { routine_exercises: RoutineItem[] };

export const routineKeys = {
  all: ["routines"] as const,
  list: () => ["routines", "list"] as const,
  detail: (id: string) => ["routines", "detail", id] as const,
  workoutCount: (id: string) => ["routines", "workout-count", id] as const,
};

export const exerciseKeys = {
  all: ["exercises"] as const,
};

/** Erro do banco com mensagem já pronta para o usuário. */
export class DataError extends Error {
  constructor(
    message: string,
    readonly code?: string,
  ) {
    super(message);
    this.name = "DataError";
  }
}

const UNIQUE_VIOLATION = "23505";

function fail(error: PostgrestError, fallback: string): never {
  console.error("[bctrl]", fallback, error);
  throw new DataError(fallback, error.code);
}

const db = () => createClient();

// ── Leituras ──────────────────────────────────────────────────────────────

export async function fetchRoutines(): Promise<RoutineListItem[]> {
  const { data, error } = await db()
    .from("routines")
    .select("*, routine_exercises(id, sets)")
    .order("position")
    .order("created_at");
  if (error) fail(error, "Não foi possível carregar as rotinas.");
  return data;
}

export async function fetchRoutine(id: string): Promise<RoutineDetail | null> {
  const { data, error } = await db()
    .from("routines")
    .select("*, routine_exercises(*, exercise:exercises(id, name, muscle_group))")
    .eq("id", id)
    .order("position", { referencedTable: "routine_exercises" })
    .maybeSingle();
  if (error) fail(error, "Não foi possível carregar a rotina.");
  return data;
}

export async function fetchExercises(): Promise<Exercise[]> {
  const { data, error } = await db().from("exercises").select("*").order("name");
  if (error) fail(error, "Não foi possível carregar os exercícios.");
  return data;
}

/** Treinos já registrados com a rotina: com algum, ela só pode ser arquivada. */
export async function fetchRoutineWorkoutCount(routineId: string): Promise<number> {
  const { count, error } = await db()
    .from("workouts")
    .select("id", { count: "exact", head: true })
    .eq("routine_id", routineId);
  if (error) fail(error, "Não foi possível verificar o histórico da rotina.");
  return count ?? 0;
}

// ── Gravações (ids gerados no cliente: reenviar não duplica) ──────────────

export async function upsertRoutine(row: TablesInsert<"routines"> & { id: string }) {
  const { error } = await db().from("routines").upsert(row, { onConflict: "id", defaultToNull: false });
  if (error) fail(error, "Não foi possível salvar a rotina.");
}

export async function updateRoutine(id: string, patch: TablesUpdate<"routines">) {
  const { error } = await db().from("routines").update(patch).eq("id", id);
  if (error) fail(error, "Não foi possível salvar a rotina.");
}

export async function deleteRoutine(id: string) {
  const { error } = await db().from("routines").delete().eq("id", id);
  if (error) fail(error, "Não foi possível excluir a rotina.");
}

/** Grava a nova ordem numa única requisição (linhas completas: o upsert valida o insert). */
export async function saveRoutinePositions(rows: Routine[]) {
  if (rows.length === 0) return;
  const payload = rows.map(({ id, user_id, name, position, notes, rest_sec, archived_at }) => ({
    id,
    user_id,
    name,
    position,
    notes,
    rest_sec,
    archived_at,
  }));
  const { error } = await db().from("routines").upsert(payload, { onConflict: "id", defaultToNull: false });
  if (error) fail(error, "Não foi possível salvar a nova ordem.");
}

export async function upsertRoutineExercise(row: TablesInsert<"routine_exercises"> & { id: string }) {
  const { error } = await db()
    .from("routine_exercises")
    .upsert(row, { onConflict: "id", defaultToNull: false });
  if (error) fail(error, "Não foi possível adicionar o exercício.");
}

export async function updateRoutineExercise(id: string, patch: TablesUpdate<"routine_exercises">) {
  const { error } = await db().from("routine_exercises").update(patch).eq("id", id);
  if (error) fail(error, "Não foi possível salvar o exercício da rotina.");
}

export async function deleteRoutineExercise(id: string) {
  const { error } = await db().from("routine_exercises").delete().eq("id", id);
  if (error) fail(error, "Não foi possível remover o exercício.");
}

export async function saveRoutineExercisePositions(rows: RoutineExercise[]) {
  if (rows.length === 0) return;
  const payload = rows.map(({ id, user_id, routine_id, exercise_id, position, sets, rest_sec, notes }) => ({
    id,
    user_id,
    routine_id,
    exercise_id,
    position,
    sets,
    rest_sec,
    notes,
  }));
  const { error } = await db()
    .from("routine_exercises")
    .upsert(payload, { onConflict: "id", defaultToNull: false });
  if (error) fail(error, "Não foi possível salvar a nova ordem.");
}

function exerciseError(error: PostgrestError, name: string): never {
  if (error.code === UNIQUE_VIOLATION) {
    throw new DataError(duplicateExerciseMessage(name), error.code);
  }
  fail(error, "Não foi possível salvar o exercício.");
}

export function duplicateExerciseMessage(name: string) {
  return `Já existe um exercício chamado “${name.trim()}”.`;
}

export async function upsertExercise(row: TablesInsert<"exercises"> & { id: string }) {
  const { error } = await db().from("exercises").upsert(row, { onConflict: "id", defaultToNull: false });
  if (error) exerciseError(error, row.name);
}

export async function updateExercise(id: string, patch: TablesUpdate<"exercises"> & { name: string }) {
  const { error } = await db().from("exercises").update(patch).eq("id", id);
  if (error) exerciseError(error, patch.name);
}

/** Itens da rotina sem o `exercise` embutido, prontos para gravar. */
export function stripExercise(item: RoutineItem): RoutineExercise {
  const { exercise, ...row } = item;
  void exercise;
  return row;
}
