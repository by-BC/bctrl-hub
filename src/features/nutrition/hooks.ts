"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import type { Food } from "@/lib/domain/nutrition";
import { fetchFoods, foodKeys } from "./api";

/** Todos os alimentos (TACO + próprios), em cache por 1 h: a TACO não muda durante o uso. */
export function useFoods() {
  return useQuery({ queryKey: foodKeys.all, queryFn: () => fetchFoods(), staleTime: 60 * 60 * 1000 });
}

/** Alimentos por id, para calcular os macros do plano. `null` enquanto carrega. */
export function useFoodsById(): ReadonlyMap<string, Food> | null {
  const { data } = useFoods();
  return useMemo(() => (data ? new Map(data.map((f) => [f.id, f])) : null), [data]);
}
