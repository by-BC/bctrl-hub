"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchWeekSummary, weekKeys } from "./api";

/**
 * Resumo da semana que começa em `weekStart` (segunda, AAAA-MM-DD). `null` espera o dia
 * ser conhecido (no navegador). Uma chamada à RPC por semana, compartilhada por Hoje,
 * Comida e Hábitos pela mesma chave.
 */
export function useWeekSummary(weekStart: string | null) {
  return useQuery({
    queryKey: weekKeys.summary(weekStart ?? ""),
    queryFn: () => fetchWeekSummary(weekStart!),
    enabled: !!weekStart,
  });
}
