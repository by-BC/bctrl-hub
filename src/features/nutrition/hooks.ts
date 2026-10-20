"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { toast } from "sonner";
import { useHasWorkout, useMealDay, useOffPlanItems } from "@/features/meals/hooks";
import { useBodyWeights } from "@/features/progress/hooks";
import { useProfile } from "@/features/profile/hooks";
import { DataError } from "@/features/routines/api";
import {
  dayTotals,
  goalsFromProfile,
  isCompleteProfile,
  optionMacros,
  snapshotMacros,
  type Food,
  type Macros,
} from "@/lib/domain/nutrition";
import { WRITES } from "@/lib/query/mutation-defaults";
import { fetchFoods, foodKeys, type OwnFoodInsert } from "./api";

/** Todos os alimentos (TACO + próprios), em cache por 1 h: a TACO não muda durante o uso. */
export function useFoods() {
  return useQuery({ queryKey: foodKeys.all, queryFn: () => fetchFoods(), staleTime: 60 * 60 * 1000 });
}

/** Alimentos por id, para calcular os macros do plano. `null` enquanto carrega. */
export function useFoodsById(): ReadonlyMap<string, Food> | null {
  const { data } = useFoods();
  return useMemo(() => (data ? new Map(data.map((f) => [f.id, f])) : null), [data]);
}

/**
 * Cria um alimento próprio (valores por 100 g). Fica na fila "meal-logs": um item fora do plano
 * que usa o alimento recém-criado só é enviado depois dele, inclusive offline.
 */
export function useCreateFood() {
  const qc = useQueryClient();
  return useMutation({
    ...WRITES.createFood,
    scope: { id: "meal-logs" },
    onMutate: async (food: OwnFoodInsert) => {
      await qc.cancelQueries({ queryKey: foodKeys.all });
      const previous = qc.getQueryData<Food[]>(foodKeys.all);
      qc.setQueryData<Food[]>(foodKeys.all, (old) => [...(old ?? []), { ...food, category: null, taco_id: null }]);
      return { previous };
    },
    onError: (error, _food, ctx) => {
      if (ctx?.previous) qc.setQueryData(foodKeys.all, ctx.previous);
      toast.error(error instanceof DataError ? error.message : "Algo deu errado. Tente de novo.");
    },
    onSettled: () => qc.invalidateQueries({ queryKey: foodKeys.all }),
  });
}

export type DayNutrition =
  | { state: "loading" }
  | { state: "error"; retry: () => unknown }
  | {
      state: "ready";
      consumed: Macros;
      /** Itens das opções marcadas sem valor (não entram no total). */
      unresolved: number;
      trainingDay: boolean;
      /** `null` com o motivo quando ainda não dá para calcular a meta. */
      goal: Macros | null;
      missing: "profile" | "weight" | null;
    };

/**
 * Consumido × meta do dia. Consumido = opções marcadas (refeições visíveis do dia) + itens fora
 * do plano dessas refeições. Meta = perfil + último peso registrado até o dia; "dia de treino"
 * segue a regra do pós-treino (treino iniciado ou finalizado no dia).
 */
export function useDayNutrition(day: string): DayNutrition {
  const meals = useMealDay(day);
  const workout = useHasWorkout(day);
  const items = useOffPlanItems(day);
  const foods = useFoodsById();
  const foodsQuery = useFoods();
  const profile = useProfile();
  const weights = useBodyWeights();

  {
    const retry = () =>
      Promise.all([meals.refetch(), items.refetch(), foodsQuery.refetch(), profile.refetch(), weights.refetch()]);
    if (meals.isError || items.isError || foodsQuery.isError || profile.isError || weights.isError) {
      return { state: "error", retry };
    }
    if (!meals.data || !items.data || !foods || profile.data === undefined || !weights.data) return { state: "loading" };

    const options: Macros[] = [];
    const logIds = new Set<string>();
    let unresolved = 0;
    for (const meal of meals.data.visible) {
      const log = meals.data.byMeal.get(meal.id);
      if (!log) continue;
      logIds.add(log.id);
      const option = !log.off_plan && log.option_id ? meal.meal_options.find((o) => o.id === log.option_id) : null;
      if (!option) continue;
      const m = optionMacros(option.items, foods);
      options.push(m.total);
      unresolved += m.unresolved;
    }
    const offPlan = items.data.filter((i) => logIds.has(i.meal_log_id)).map(snapshotMacros);
    const consumed = dayTotals({ options, offPlan });

    const trainingDay = workout.hasWorkout;
    const weight = [...weights.data].reverse().find((w) => w.day <= day) ?? weights.data.at(-1);
    const p = profile.data;
    const missing = !isCompleteProfile(p) ? "profile" : !weight ? "weight" : null;
    const goal = isCompleteProfile(p) && weight ? goalsFromProfile(p, weight.weight_kg, trainingDay, day) : null;
    return { state: "ready", consumed, unresolved, trainingDay, goal, missing };
  }
}
