"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { toast } from "sonner";
import type { Meal } from "@/features/meals/api";
import { useMealPlan } from "@/features/meals/hooks";
import { fetchFoods, foodKeys } from "@/features/nutrition/api";
import { useBodyWeights } from "@/features/progress/hooks";
import { useToday } from "@/features/progress/use-today";
import { DataError } from "@/features/routines/api";
import { useMeasurements } from "@/features/composition/hooks";
import { compositionKeys, fetchCompositionGoalAchievements } from "@/features/composition/api";
import type { Measurement } from "@/features/composition/api";
import { bmrInputFrom } from "@/lib/domain/composition";
import { evaluateAchievements, type AchievementView } from "@/lib/domain/achievements";
import {
  goalsFromProfile,
  isCompleteProfile,
  monthNutrition,
  type Food,
  type MonthNutrition,
  type PlanItem,
} from "@/lib/domain/nutrition";
import { monthEnd } from "@/lib/domain/week";
import { WRITES } from "@/lib/query/mutation-defaults";
import {
  fetchDailyScores,
  fetchMonthSummary,
  fetchProfile,
  fetchScoreHistory,
  profileKeys,
  scoreKeys,
  type MonthNumbers,
  type MonthSummary,
  type Profile,
  type ProfileSave,
} from "./api";

export function useProfile() {
  return useQuery({ queryKey: profileKeys.me(), queryFn: () => fetchProfile() });
}

/** Salvar o perfil: otimista (as metas mudam na hora), desfaz no erro e revalida no fim. */
export function useSaveProfile() {
  const qc = useQueryClient();
  const key = profileKeys.me();
  return useMutation({
    ...WRITES.saveProfile,
    scope: { id: "profile" },
    onMutate: async (row: ProfileSave) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<Profile | null>(key);
      qc.setQueryData<Profile | null>(key, row);
      return { previous };
    },
    onError: (error, _row, ctx) => {
      if (ctx && ctx.previous !== undefined) qc.setQueryData(key, ctx.previous);
      toast.error(error instanceof DataError ? error.message : "Algo deu errado. Tente de novo.");
    },
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  });
}

// ── Pontuação do dia, resumo do mês e conquistas ──────────────────────────

/** Pontuação e fatos de cada dia de `from` a `to` (heatmap). `null` espera as datas (no navegador). */
export function useDailyScores(from: string | null, to: string | null) {
  return useQuery({
    queryKey: scoreKeys.range(from ?? "", to ?? ""),
    queryFn: () => fetchDailyScores(from!, to!),
    enabled: !!from && !!to,
  });
}

export type MonthNutritionPair = { current: MonthNutrition; previous: MonthNutrition };

/**
 * Metas de descanso e de treino válidas no mês: perfil + último peso até o fim do mês (ou até
 * hoje, no mês em curso). Sem perfil completo ou sem peso, `null`.
 */
function monthGoals(
  profile: Profile | null | undefined,
  weights: readonly { day: string; weight_kg: number }[],
  measurements: readonly Measurement[],
  onDay: string,
) {
  if (!isCompleteProfile(profile) || weights.length === 0) return null;
  const weight = [...weights].reverse().find((w) => w.day <= onDay) ?? weights[0];
  const bmr = bmrInputFrom(measurements, onDay);
  return {
    rest: goalsFromProfile(profile, weight.weight_kg, false, onDay, bmr),
    training: goalsFromProfile(profile, weight.weight_kg, true, onDay, bmr),
  };
}

/** kcal e proteína médias × meta do mês e do anterior; `null` enquanto algum dado falta. */
function monthNutritionPair(
  summary: MonthSummary | undefined,
  plan: readonly Meal[] | undefined,
  foods: readonly Food[] | undefined,
  profile: Profile | null | undefined,
  weights: readonly { day: string; weight_kg: number }[] | undefined,
  measurements: readonly Measurement[] | undefined,
  today: string | null,
): MonthNutritionPair | null {
  if (!summary || !plan || !foods || profile === undefined || !weights || !measurements || !today) return null;
  const optionItems = new Map<string, readonly PlanItem[]>(
    plan.flatMap((meal) => meal.meal_options.map((o) => [o.id, o.items as PlanItem[]] as const)),
  );
  const foodsById = new Map<string, Food>(foods.map((f) => [f.id, f]));
  const of = (numbers: MonthNumbers) => {
    const end = monthEnd(numbers.month);
    const goals = monthGoals(profile, weights, measurements, end < today ? end : today);
    return monthNutrition(numbers.nutrition, optionItems, foodsById, goals);
  };
  return { current: of(summary.current), previous: of(summary.previous) };
}

/** Só os números do `month_summary` de `month` (e do anterior), sem a nutrição. */
export function useMonthNumbers(month: string | null) {
  return useQuery({
    queryKey: scoreKeys.month(month ?? ""),
    queryFn: () => fetchMonthSummary(month!),
    enabled: !!month,
  });
}

/**
 * Resumo do mês (`month_summary`) de `month` (qualquer dia do mês) e do anterior. `nutrition`
 * traz kcal e proteína médias × meta de cada um, calculadas no cliente com o plano, a TACO e o
 * perfil (`null` enquanto algum deles carrega).
 */
export function useMonthSummary(month: string | null) {
  const today = useToday();
  const summary = useMonthNumbers(month);
  const plan = useMealPlan();
  const foods = useQuery({ queryKey: foodKeys.all, queryFn: () => fetchFoods(), staleTime: 60 * 60 * 1000 });
  const profile = useProfile();
  const weights = useBodyWeights();
  const measurements = useMeasurements();

  const data = summary.data;
  const meals = plan.data;
  const foodList = foods.data;
  const me = profile.data;
  const weightList = weights.data;
  const measurementList = measurements.data;
  const nutrition = useMemo(
    () => monthNutritionPair(data, meals, foodList, me, weightList, measurementList, today),
    [data, meals, foodList, me, weightList, measurementList, today],
  );

  return { ...summary, nutrition };
}

/**
 * Conquistas avaliadas sobre o histórico inteiro (do 1º treino, inclusive os importados do
 * Hevy, até hoje), em chamadas de até 400 dias ao `daily_scores`.
 */
export function useAchievements() {
  const today = useToday();
  const measurements = useMeasurements();
  const goals = useQuery({
    queryKey: compositionKeys.goalAchievements(),
    queryFn: () => fetchCompositionGoalAchievements(),
  });
  const history = useQuery({
    queryKey: scoreKeys.history(today ?? ""),
    queryFn: () => fetchScoreHistory(today!),
    enabled: !!today,
  });
  const achievements = useMemo(
    (): AchievementView[] | null =>
      history.data && measurements.data && goals.data && today
        ? evaluateAchievements({
            days: history.data,
            today,
            measurements: measurements.data.map((measurement) => ({
              day: measurement.day,
              measuredAt: measurement.measured_at,
              bodyFatPct: measurement.body_fat_pct,
            })),
            goals: goals.data,
          })
        : null,
    [goals.data, history.data, measurements.data, today],
  );
  return {
    ...history,
    isPending: history.isPending || measurements.isPending || goals.isPending,
    isError: history.isError || measurements.isError || goals.isError,
    refetch: () => Promise.all([history.refetch(), measurements.refetch(), goals.refetch()]),
    achievements,
  };
}
