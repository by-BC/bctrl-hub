"use client";

import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { DataError } from "@/features/routines/api";
import { progressKeys } from "@/features/progress/api";
import { profileKeys } from "@/features/profile/api";
import { weekKeys } from "@/features/week/api";
import { WRITES } from "@/lib/query/mutation-defaults";
import { bmrInputFrom, newlyAchieved } from "@/lib/domain/composition";
import type { BmrInput } from "@/lib/domain/nutrition";
import {
  compositionKeys,
  fetchCompositionGoals,
  fetchMeasurements,
  type CompositionGoal,
  type CompositionGoalPatch,
  type CompositionGoalSave,
  type Measurement,
} from "./api";

/** Todas as medições, em ordem cronológica (a mais recente por último). */
export function useMeasurements() {
  return useQuery({ queryKey: compositionKeys.measurements(), queryFn: () => fetchMeasurements() });
}

/** A medição mais recente (`null` sem nenhuma), da mesma consulta de `useMeasurements`. */
export function useLatestMeasurement() {
  return useQuery({
    queryKey: compositionKeys.measurements(),
    queryFn: () => fetchMeasurements(),
    select: (list) => list.at(-1) ?? null,
  });
}

/**
 * TMB e massa magra das medições para as metas nutricionais (`goalsFromProfile`): a última TMB e a
 * última massa magra até `day`. Mesma consulta de `useLatestMeasurement`. `undefined` sem medição
 * (ou com `day` nulo); `isPending`/`isError` para quem espera os dados.
 */
export function useBmrInput(day: string | null) {
  return useQuery({
    queryKey: compositionKeys.measurements(),
    queryFn: () => fetchMeasurements(),
    select: (list): BmrInput | null => (day ? (bmrInputFrom(list, day) ?? null) : null),
  });
}

const COMPOSITION_MUTATION_KEY = ["composition"] as const;

/**
 * A última gravação de composição da fila (medição ou meta) revalida tudo o que depende dela:
 * composição, peso do dia, perfil e metas nutricionais, resumo do mês e pontuações ("week").
 */
function settleComposition(qc: QueryClient) {
  if (qc.isMutating({ mutationKey: COMPOSITION_MUTATION_KEY }) !== 1) return;
  return Promise.all([
    qc.invalidateQueries({ queryKey: compositionKeys.all }),
    qc.invalidateQueries({ queryKey: progressKeys.bodyWeights() }),
    qc.invalidateQueries({ queryKey: profileKeys.all }),
    qc.invalidateQueries({ queryKey: weekKeys.all }),
  ]);
}

const byInstant = (list: Measurement[]) =>
  [...list].sort((a, b) => Date.parse(a.measured_at) - Date.parse(b.measured_at));

/**
 * Gravações de medição: otimistas na lista, em fila única (`scope`) e, quando a última termina,
 * revalidam tudo o que depende da medição. O trigger do banco grava o peso do dia, então o peso
 * da Evolução, as metas nutricionais (peso e TMB), o Perfil e o resumo do mês também mudam.
 */
function useMeasurementMutation<V>(
  write: { mutationKey: readonly [string, string]; mutationFn: (v: V) => Promise<void> },
  apply: (list: Measurement[], v: V) => Measurement[],
  /** Mensagem de sucesso. Fica no hook, não no `mutate`: o sheet fecha antes de a gravação voltar. */
  success: (v: V, existed: boolean) => string,
  exists: (list: Measurement[], v: V) => boolean,
) {
  const qc = useQueryClient();
  const key = compositionKeys.measurements();
  const achieve = useUpdateCompositionGoal({ silent: true });
  return useMutation({
    ...write,
    scope: { id: "composition" },
    onMutate: async (vars: V) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<Measurement[]>(key);
      qc.setQueryData<Measurement[]>(key, (old) => byInstant(apply(old ?? [], vars)));
      return { previous, existed: exists(previous ?? [], vars) };
    },
    onSuccess: async (_data, vars, ctx) => {
      toast.success(success(vars, ctx?.existed ?? false));
      if (!isMeasurement(vars)) return;
      // A medição salva atingiu o alvo de alguma meta ativa: marca a data (só as ainda não marcadas).
      const goals = await qc.ensureQueryData({ queryKey: compositionKeys.goals(), queryFn: () => fetchCompositionGoals() }).catch(() => []);
      for (const { id, achieved_on } of newlyAchieved(goals, vars)) {
        achieve.mutate({ id, patch: { achieved_on } });
        toast.success("Meta de composição atingida!");
      }
    },
    onError: (error, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(key, ctx.previous);
      toast.error(error instanceof DataError ? error.message : "Algo deu errado. Tente de novo.");
    },
    onSettled: () => settleComposition(qc),
  });
}

const isMeasurement = (v: unknown): v is Measurement =>
  typeof v === "object" && v !== null && "measured_at" in v && "weight_kg" in v;

/** Cria ou edita uma medição (upsert pelo id gerado no cliente). */
export function useSaveMeasurement() {
  return useMeasurementMutation(
    WRITES.addMeasurement,
    (list, row) => [...list.filter((m) => m.id !== row.id), row],
    (_row, existed) => (existed ? "Medição atualizada." : "Medição registrada."),
    (list, row) => list.some((m) => m.id === row.id),
  );
}

export function useDeleteMeasurement() {
  return useMeasurementMutation(
    WRITES.deleteMeasurement,
    (list, id) => list.filter((m) => m.id !== id),
    () => "Medição excluída.",
    () => true,
  );
}

// ── Metas de composição ───────────────────────────────────────────────────

/** Metas ativas (não arquivadas), no máximo uma por métrica. */
export function useCompositionGoals() {
  return useQuery({ queryKey: compositionKeys.goals(), queryFn: () => fetchCompositionGoals() });
}

/**
 * Gravações de meta: otimistas na lista, em fila única com as medições (`scope`), desfazem no
 * erro; a última da fila revalida tudo (`settleComposition`).
 */
function useGoalMutation<V>(
  write: { mutationKey: readonly [string, string]; mutationFn: (v: V) => Promise<void> },
  apply: (list: CompositionGoal[], v: V) => CompositionGoal[],
  success: ((v: V) => string) | null,
) {
  const qc = useQueryClient();
  const key = compositionKeys.goals();
  return useMutation({
    ...write,
    scope: { id: "composition" },
    onMutate: async (vars: V) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<CompositionGoal[]>(key);
      if (previous) qc.setQueryData<CompositionGoal[]>(key, apply(previous, vars));
      return { previous };
    },
    onSuccess: (_data, vars) => {
      if (success) toast.success(success(vars));
    },
    onError: (error, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(key, ctx.previous);
      toast.error(error instanceof DataError ? error.message : "Algo deu errado. Tente de novo.");
    },
    onSettled: () => settleComposition(qc),
  });
}

/** Cria ou substitui a meta (upsert pelo id gerado no cliente). */
export function useSaveCompositionGoal() {
  return useGoalMutation(
    WRITES.saveCompositionGoal,
    (list, row: CompositionGoalSave) => {
      const old = list.find((g) => g.id === row.id);
      const next: CompositionGoal = { achieved_on: null, archived_at: null, ...old, ...row };
      return old ? list.map((g) => (g.id === row.id ? next : g)) : [...list, next];
    },
    () => "Meta salva.",
  );
}

/** Altera a meta (alvo, data-alvo, conclusão ou arquivamento). Arquivada sai da lista. */
export function useUpdateCompositionGoal({ silent = false }: { silent?: boolean } = {}) {
  return useGoalMutation(
    WRITES.updateCompositionGoal,
    (list, { id, patch }: { id: string; patch: CompositionGoalPatch }) =>
      patch.archived_at ? list.filter((g) => g.id !== id) : list.map((g) => (g.id === id ? { ...g, ...patch } : g)),
    silent ? null : ({ patch }) => (patch.archived_at ? "Meta arquivada." : "Meta atualizada."),
  );
}
