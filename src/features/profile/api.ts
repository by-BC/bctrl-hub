import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import {
  ACTIVITY_LEVELS,
  GOALS,
  SEXES,
  type ActivityLevel,
  type Goal,
  type GoalOverrides,
  type NutritionProfile,
  type Sex,
} from "@/lib/domain/nutrition";
import { goalOverridesSchema } from "@/lib/schemas/profile";
import { createClient } from "@/lib/supabase/client";
import { DataError } from "@/features/routines/api";

/**
 * Perfil (`profiles`, 1 linha por usuário, RLS de dono). Dados de saúde: só o dono lê.
 * O cliente é parâmetro para os testes de integração usarem um usuário descartável.
 */

type Client = SupabaseClient<Database>;
const db = (): Client => createClient();

export const profileKeys = {
  all: ["profile"] as const,
  me: () => ["profile", "me"] as const,
};

export type Profile = NutritionProfile & { goal_overrides: GoalOverrides };

/** O que o formulário grava (o `user_id` vem do default `auth.uid()`). */
export type ProfileSave = {
  sex: Sex;
  birth_date: string;
  height_cm: number;
  activity_level: ActivityLevel;
  goal: Goal;
  protein_g_per_kg: number;
  goal_overrides: GoalOverrides;
};

function fail(error: { message: string; code?: string }, message: string): never {
  console.error("[bctrl]", message, error);
  throw new DataError(message, error.code);
}

const oneOf = <T extends string>(list: readonly T[], v: string | null): T | null =>
  v !== null && (list as readonly string[]).includes(v) ? (v as T) : null;

/** Perfil do usuário logado, ou `null` se ainda não foi preenchido. */
export async function fetchProfile(client: Client = db()): Promise<Profile | null> {
  const { data, error } = await client
    .from("profiles")
    .select("sex, birth_date, height_cm, activity_level, goal, protein_g_per_kg, goal_overrides")
    .maybeSingle();
  if (error) fail(error, "Não foi possível carregar o perfil.");
  if (!data) return null;
  return {
    sex: oneOf(SEXES, data.sex),
    birth_date: data.birth_date,
    height_cm: data.height_cm === null ? null : Number(data.height_cm),
    activity_level: oneOf(ACTIVITY_LEVELS, data.activity_level),
    goal: oneOf(GOALS, data.goal),
    protein_g_per_kg: Number(data.protein_g_per_kg),
    goal_overrides: goalOverridesSchema.parse(data.goal_overrides),
  };
}

/**
 * Grava o perfil (cria na 1ª vez, depois atualiza). A chave é o próprio `user_id`, que vem do
 * default `auth.uid()` (`defaultToNull: false`): reenviar é idempotente.
 */
export async function upsertProfile(row: ProfileSave, client: Client = db()) {
  const { error } = await client
    .from("profiles")
    .upsert({ ...row, updated_at: new Date().toISOString() }, { onConflict: "user_id", defaultToNull: false });
  if (error) fail(error, "Não foi possível salvar o perfil.");
}
