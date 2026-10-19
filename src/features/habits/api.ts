import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/client";
import { DataError } from "@/features/routines/api";

/**
 * Hábitos e registros (supabase-js direto, protegido por RLS). O cliente é parâmetro
 * para os testes de integração usarem um usuário descartável.
 * O hábito "Treino" não está aqui: vem dos `workouts` finalizados (`week_summary`).
 */

type Client = SupabaseClient<Database>;
const db = (): Client => createClient();

export const habitKeys = {
  all: ["habits"] as const,
  list: () => ["habits", "list"] as const,
  logs: (from: string, to: string) => ["habits", "logs", from, to] as const,
  /** Dias com treino finalizado (streak do "Treino"). */
  trainedDays: (from: string, to: string) => ["habits", "trained-days", from, to] as const,
};

export type Habit = Tables<"habits">;
export type HabitLog = Pick<
  Tables<"habit_logs">,
  "id" | "habit_id" | "day" | "value" | "cardio_type" | "distance_km" | "kcal" | "created_at"
>;
export type HabitInsert = Pick<Habit, "id" | "name" | "kind" | "period" | "target" | "unit">;
export type HabitPatch = Partial<Pick<Habit, "name" | "kind" | "period" | "target" | "unit" | "archived_at">>;
export type HabitLogInsert = Omit<HabitLog, "created_at">;

/** Código do `raise exception` do trigger que protege os hábitos do sistema. */
const SYSTEM_HABIT_ERROR = "P0001";

function fail(error: { message: string; code?: string }, message: string): never {
  console.error("[bctrl]", message, error);
  throw new DataError(message, error.code);
}

// ── Leituras ──────────────────────────────────────────────────────────────

/** Todos os hábitos (inclusive arquivados): os do sistema primeiro, depois por criação. */
export async function fetchHabits(client: Client = db()): Promise<Habit[]> {
  const { data, error } = await client
    .from("habits")
    .select("*")
    .order("system_key", { nullsFirst: false })
    .order("created_at")
    .order("id");
  if (error) fail(error, "Não foi possível carregar os hábitos.");
  return data;
}

/** Registros de todos os hábitos entre `from` e `to` (inclusive). */
export async function fetchHabitLogs(from: string, to: string, client: Client = db()): Promise<HabitLog[]> {
  const { data, error } = await client
    .from("habit_logs")
    .select("id, habit_id, day, value, cardio_type, distance_km, kcal, created_at")
    .gte("day", from)
    .lte("day", to)
    .order("day")
    .order("created_at");
  if (error) fail(error, "Não foi possível carregar os registros dos hábitos.");
  return data;
}

/** Dias distintos com treino finalizado entre `from` e `to`. */
export async function fetchTrainedDays(from: string, to: string, client: Client = db()): Promise<string[]> {
  const { data, error } = await client
    .from("workouts")
    .select("day")
    .not("finished_at", "is", null)
    .gte("day", from)
    .lte("day", to);
  if (error) fail(error, "Não foi possível carregar os treinos.");
  return [...new Set(data.map((w) => w.day))].sort();
}

// ── Hábitos ───────────────────────────────────────────────────────────────

/** Cria (ou reenvia) o hábito: id do cliente + upsert, `user_id` pelo default. */
export async function upsertHabit(row: HabitInsert, client: Client = db()) {
  const { error } = await client.from("habits").upsert(row, { defaultToNull: false });
  if (error) fail(error, "Não foi possível salvar o hábito.");
}

export async function updateHabit(id: string, patch: HabitPatch, client: Client = db()) {
  const { error } = await client.from("habits").update(patch).eq("id", id);
  if (error) fail(error, "Não foi possível salvar o hábito.");
}

/** Exclui o hábito e os registros dele (cascata). O banco recusa os hábitos do sistema. */
export async function deleteHabit(id: string, client: Client = db()) {
  const { error } = await client.from("habits").delete().eq("id", id);
  if (error) {
    fail(
      error,
      error.code === SYSTEM_HABIT_ERROR
        ? "Este é um hábito do sistema: dá para editar, mas não excluir."
        : "Não foi possível excluir o hábito.",
    );
  }
}

// ── Registros ─────────────────────────────────────────────────────────────

/** Registro idempotente: reenviar o mesmo id não duplica. */
export async function upsertHabitLog(log: HabitLogInsert, client: Client = db()) {
  const { error } = await client.from("habit_logs").upsert(log, { defaultToNull: false });
  if (error) fail(error, "Não foi possível registrar o hábito.");
}

export async function deleteHabitLogs(ids: string[], client: Client = db()) {
  if (ids.length === 0) return;
  const { error } = await client.from("habit_logs").delete().in("id", ids);
  if (error) fail(error, "Não foi possível desfazer o registro.");
}
