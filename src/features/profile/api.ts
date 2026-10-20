import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import type { PrKind } from "@/lib/domain/exercise-types";
import {
  ACTIVITY_LEVELS,
  GOALS,
  SEXES,
  type ActivityLevel,
  type Goal,
  type GoalOverrides,
  type MonthNutritionFacts,
  type NutritionProfile,
  type Sex,
} from "@/lib/domain/nutrition";
import { MAX_SCORE_DAYS, scoreChunks, toDayFacts, type DayFacts } from "@/lib/domain/score";
import { addDays } from "@/lib/domain/stats";
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

// ── Pontuação do dia e resumo do mês ──────────────────────────────────────

/**
 * Chaves sob `weekKeys.all` (["week"]): toda gravação que mexe em treinos, refeições, hábitos ou
 * tarefas já invalida esse prefixo, então heatmap, resumo e conquistas se refazem junto.
 */
export const scoreKeys = {
  all: ["week", "scores"] as const,
  range: (from: string, to: string) => ["week", "scores", "range", from, to] as const,
  month: (month: string) => ["week", "scores", "month", month] as const,
  history: (today: string) => ["week", "scores", "history", today] as const,
};

/** Pontuação e fatos de cada dia de `from` a `to` (até 400 dias; dias futuros não vêm). */
export async function fetchDailyScores(from: string, to: string, client: Client = db()): Promise<DayFacts[]> {
  const { data, error } = await client.rpc("daily_scores", { p_from: from, p_to: to });
  if (error) fail(error, "Não foi possível carregar a pontuação dos dias.");
  return (data ?? []).map(toDayFacts);
}

/** Primeiro dia com treino finalizado (o histórico do Hevy começa aqui), ou `null`. */
export async function fetchFirstWorkoutDay(client: Client = db()): Promise<string | null> {
  const { data, error } = await client
    .from("workouts")
    .select("day")
    .not("finished_at", "is", null)
    .order("day", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) fail(error, "Não foi possível carregar o histórico.");
  return data?.day ?? null;
}

/**
 * Fatos de todos os dias, do primeiro treino (ou dos últimos 400 dias, o que vier antes) até
 * `today`, em chamadas de até 400 dias. Base das conquistas, que contam o histórico do Hevy.
 */
export async function fetchScoreHistory(today: string, client: Client = db()): Promise<DayFacts[]> {
  const first = await fetchFirstWorkoutDay(client);
  const recent = addDays(today, -(MAX_SCORE_DAYS - 1));
  const from = first && first < recent ? first : recent;
  const chunks = await Promise.all(scoreChunks(from, today).map(([a, b]) => fetchDailyScores(a, b, client)));
  return chunks.flat();
}

export type MonthPr = {
  day: string;
  exercise_id: string;
  exercise: string;
  kind: PrKind;
  value: number;
  weight_kg: number | null;
  reps: number | null;
  distance_m: number | null;
  duration_s: number | null;
};

/** Números de um mês (`month_summary`), contados até hoje. */
export type MonthNumbers = {
  month: string;
  days: number;
  workouts: number;
  volume_kg: number;
  prs: { count: number; list: MonthPr[] };
  control_days: number;
  meals: { planned: number; done: number; pct: number };
  cardio: { minutes: number; distance_km: number; sessions: number };
  nutrition: MonthNutritionFacts;
};

export type MonthSummary = { month: string; current: MonthNumbers; previous: MonthNumbers };

/** Resumo do mês de `month` (qualquer dia do mês) e do mês anterior. */
export async function fetchMonthSummary(month: string, client: Client = db()): Promise<MonthSummary> {
  const { data, error } = await client.rpc("month_summary", { p_month: month });
  if (error) fail(error, "Não foi possível carregar o resumo do mês.");
  return data as unknown as MonthSummary;
}
