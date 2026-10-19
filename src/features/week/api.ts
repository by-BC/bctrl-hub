import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/client";
import { DataError } from "@/features/routines/api";

/**
 * Resumo da semana (RPC `week_summary`): uma ida ao banco para a adesão alimentar da
 * semana, o Hoje e o Hex Week. Toda gravação que muda treinos, refeições ou hábitos
 * invalida `weekKeys.all`.
 */

type Client = SupabaseClient<Database>;

export const weekKeys = {
  all: ["week"] as const,
  summary: (weekStart: string) => ["week", "summary", weekStart] as const,
};

export type WeekSummary = {
  week_start: string;
  week_end: string;
  workouts: { done: number; target: number };
  meals: { planned: number; done: number; pct: number };
  days: { day: string; trained: boolean; meals_planned: number; meals_done: number }[];
  cardio: { minutes: number; distance_km: number; kcal: number; sessions: number; target: number | null } | null;
  abs: { done: number; target: number | null } | null;
  supplements: { done: number; target: number | null } | null;
  habits: unknown[];
};

export async function fetchWeekSummary(weekStart: string, client: Client = createClient()): Promise<WeekSummary> {
  const { data, error } = await client.rpc("week_summary", { p_week_start: weekStart });
  if (error) {
    console.error("[bctrl]", "Não foi possível carregar o resumo da semana.", error);
    throw new DataError("Não foi possível carregar o resumo da semana.", error.code);
  }
  return data as unknown as WeekSummary;
}
