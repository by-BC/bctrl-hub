"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { toast } from "sonner";
import { DataError } from "@/features/routines/api";
import {
  filterByRange,
  groupExerciseHistory,
  listPrs,
  toSessionSeries,
  type Range,
} from "@/lib/domain/stats";
import {
  deleteBodyWeight,
  fetchBodyWeights,
  fetchExercise,
  fetchExerciseHistory,
  fetchExerciseStats,
  fetchProgressOverview,
  progressKeys,
  upsertBodyWeight,
  type BodyWeight,
} from "./api";
import { useToday } from "./use-today";

export function useProgressOverview() {
  return useQuery({ queryKey: progressKeys.overview(), queryFn: () => fetchProgressOverview() });
}

/** Nome e recordes de todos os tempos (`v_exercise_bests`). */
export function useExerciseBests(exerciseId: string, enabled = true) {
  return useQuery({ queryKey: progressKeys.exercise(exerciseId), queryFn: () => fetchExercise(exerciseId), enabled });
}

/**
 * Série do gráfico no período. A consulta traz tudo uma vez e o período só filtra
 * no cliente: trocar o filtro não vai à rede nem recarrega a página.
 */
export function useExerciseStats(exerciseId: string, range: Range, enabled = true) {
  const query = useQuery({
    queryKey: progressKeys.stats(exerciseId),
    queryFn: () => fetchExerciseStats(exerciseId),
    select: toSessionSeries,
    enabled,
  });
  const today = useToday();
  const points = useMemo(
    () => (query.data && today ? filterByRange(query.data, range, today) : undefined),
    [query.data, range, today],
  );
  return { ...query, all: query.data, points };
}

/** Séries por treino (mais recente primeiro) e as que bateram recorde. */
export function useExerciseHistory(exerciseId: string, enabled = true) {
  return useQuery({
    queryKey: progressKeys.history(exerciseId),
    queryFn: () => fetchExerciseHistory(exerciseId),
    select: (rows) => {
      const sessions = groupExerciseHistory(rows);
      return { sessions, prs: listPrs(sessions) };
    },
    enabled,
  });
}

export function useBodyWeights() {
  return useQuery({ queryKey: progressKeys.bodyWeights(), queryFn: () => fetchBodyWeights() });
}

const BODY_WEIGHT_MUTATION_KEY = ["body-weights"] as const;

function sortByDay(list: BodyWeight[]) {
  return [...list].sort((a, b) => a.day.localeCompare(b.day));
}

/** Gravações de peso: otimistas, em fila única e revalidadas quando a última termina. */
function useBodyWeightMutation<V>(mutationFn: (v: V) => Promise<void>, apply: (list: BodyWeight[], v: V) => BodyWeight[]) {
  const qc = useQueryClient();
  const key = progressKeys.bodyWeights();
  return useMutation({
    mutationKey: BODY_WEIGHT_MUTATION_KEY,
    scope: { id: "body-weights" },
    mutationFn,
    onMutate: async (vars: V) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<BodyWeight[]>(key);
      qc.setQueryData<BodyWeight[]>(key, (old) => sortByDay(apply(old ?? [], vars)));
      return { previous };
    },
    onError: (error, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(key, ctx.previous);
      toast.error(error instanceof DataError ? error.message : "Algo deu errado. Tente de novo.");
    },
    onSettled: () => {
      if (qc.isMutating({ mutationKey: BODY_WEIGHT_MUTATION_KEY }) === 1) {
        return qc.invalidateQueries({ queryKey: key });
      }
    },
  });
}

/** Registra o peso do dia; se já houver um no mesmo dia, substitui. */
export function useUpsertBodyWeight() {
  return useBodyWeightMutation(
    (entry: BodyWeight) => upsertBodyWeight(entry),
    (list, entry) => [...list.filter((w) => w.day !== entry.day), entry],
  );
}

export function useDeleteBodyWeight() {
  return useBodyWeightMutation(
    (day: string) => deleteBodyWeight(day),
    (list, day) => list.filter((w) => w.day !== day),
  );
}
