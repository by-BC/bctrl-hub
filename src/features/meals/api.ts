import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/client";
import { DataError } from "@/features/routines/api";
import { workoutKeys } from "@/features/workout-session/api";
import { storedMealItemsSchema, type MealItem } from "@/lib/schemas/meal";

/**
 * Plano alimentar e registro do dia (supabase-js direto, protegido por RLS).
 * O cliente é parâmetro para os testes de integração usarem um usuário descartável.
 */

type Client = SupabaseClient<Database>;
const db = (): Client => createClient();

export const mealKeys = {
  all: ["meals"] as const,
  plan: () => ["meals", "plan"] as const,
  logs: (day: string) => ["meals", "logs", day] as const,
};

/** Fica sob `workoutKeys.all`: finalizar ou excluir um treino já revalida. */
export const workoutDayKey = (day: string) => [...workoutKeys.all, "on-day", day] as const;

export type MealRow = Tables<"meals">;
export type MealOption = Omit<Tables<"meal_options">, "items"> & { items: MealItem[] };
export type Meal = MealRow & { meal_options: MealOption[] };
export type MealLog = Pick<Tables<"meal_logs">, "id" | "day" | "meal_id" | "option_id" | "off_plan" | "note">;

function fail(error: { message: string; code?: string }, message: string): never {
  console.error("[bctrl]", message, error);
  throw new DataError(message, error.code);
}

// ── Leituras ──────────────────────────────────────────────────────────────

/** Refeições com as opções, em ordem de `position` (a tela do dia reordena por horário). */
export async function fetchMealPlan(client: Client = db()): Promise<Meal[]> {
  const { data, error } = await client
    .from("meals")
    .select("*, meal_options(*)")
    .order("position")
    .order("created_at")
    .order("position", { referencedTable: "meal_options" })
    .order("created_at", { referencedTable: "meal_options" });
  if (error) fail(error, "Não foi possível carregar o plano alimentar.");
  return data.map((meal) => ({
    ...meal,
    meal_options: meal.meal_options.map((o) => ({ ...o, items: storedMealItemsSchema.parse(o.items) })),
  }));
}

export async function fetchMealLogs(day: string, client: Client = db()): Promise<MealLog[]> {
  const { data, error } = await client
    .from("meal_logs")
    .select("id, day, meal_id, option_id, off_plan, note")
    .eq("day", day);
  if (error) fail(error, "Não foi possível carregar as refeições do dia.");
  return data;
}

/** Algum treino finalizado com esse `day`? (A sessão ativa no aparelho é vista à parte.) */
export async function fetchHasFinishedWorkout(day: string, client: Client = db()): Promise<boolean> {
  const { count, error } = await client
    .from("workouts")
    .select("id", { count: "exact", head: true })
    .eq("day", day)
    .not("finished_at", "is", null);
  if (error) fail(error, "Não foi possível conferir os treinos do dia.");
  return (count ?? 0) > 0;
}

// ── Registro do dia ───────────────────────────────────────────────────────

/**
 * Marca a refeição do dia (opção escolhida ou fora do plano). A chave natural
 * `(user_id, day, meal_id)` é a de idempotência: reenviar ou trocar a opção atualiza o
 * mesmo registro, sem duplicar. `defaultToNull: false` mantém o `user_id` do default.
 */
export async function upsertMealLog(log: MealLog, client: Client = db()) {
  const { error } = await client
    .from("meal_logs")
    .upsert(log, { onConflict: "user_id,day,meal_id", defaultToNull: false });
  if (error) fail(error, "Não foi possível registrar a refeição.");
}

export async function deleteMealLog({ day, meal_id }: Pick<MealLog, "day" | "meal_id">, client: Client = db()) {
  const { error } = await client.from("meal_logs").delete().eq("day", day).eq("meal_id", meal_id);
  if (error) fail(error, "Não foi possível desmarcar a refeição.");
}

// ── Plano ─────────────────────────────────────────────────────────────────

export type MealInsert = Pick<MealRow, "id" | "name" | "time" | "position" | "training_day_only">;
export type MealPatch = Partial<Pick<MealRow, "name" | "time" | "training_day_only" | "position">>;

export async function upsertMeal(row: MealInsert, client: Client = db()) {
  const { error } = await client.from("meals").upsert(row, { defaultToNull: false });
  if (error) fail(error, "Não foi possível salvar a refeição.");
}

export async function updateMeal(id: string, patch: MealPatch, client: Client = db()) {
  const { error } = await client.from("meals").update(patch).eq("id", id);
  if (error) fail(error, "Não foi possível salvar a refeição.");
}

/** Grava as novas posições (uma atualização por refeição que mudou de lugar). */
export async function saveMealPositions(rows: Pick<MealRow, "id" | "position">[], client: Client = db()) {
  const results = await Promise.all(rows.map((r) => client.from("meals").update({ position: r.position }).eq("id", r.id)));
  const failed = results.find((r) => r.error);
  if (failed?.error) fail(failed.error, "Não foi possível reordenar as refeições.");
}

/** Exclui a refeição; as opções e os registros dela somem junto (cascata). */
export async function deleteMeal(id: string, client: Client = db()) {
  const { error } = await client.from("meals").delete().eq("id", id);
  if (error) fail(error, "Não foi possível excluir a refeição.");
}

export type MealOptionInsert = Pick<MealOption, "id" | "meal_id" | "position" | "title" | "items">;
export type MealOptionPatch = Partial<Pick<MealOption, "title" | "items" | "position">>;

export async function upsertMealOption(row: MealOptionInsert, client: Client = db()) {
  const { error } = await client.from("meal_options").upsert(row, { defaultToNull: false });
  if (error) fail(error, "Não foi possível salvar a opção.");
}

export async function updateMealOption(id: string, patch: MealOptionPatch, client: Client = db()) {
  const { error } = await client.from("meal_options").update(patch).eq("id", id);
  if (error) fail(error, "Não foi possível salvar a opção.");
}

/** Exclui a opção; registros que a usavam continuam feitos, sem opção (`on delete set null`). */
export async function deleteMealOption(id: string, client: Client = db()) {
  const { error } = await client.from("meal_options").delete().eq("id", id);
  if (error) fail(error, "Não foi possível excluir a opção.");
}
