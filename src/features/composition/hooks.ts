"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { DataError } from "@/features/routines/api";
import { progressKeys } from "@/features/progress/api";
import { profileKeys } from "@/features/profile/api";
import { weekKeys } from "@/features/week/api";
import { WRITES } from "@/lib/query/mutation-defaults";
import { compositionKeys, fetchMeasurements, type Measurement } from "./api";

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

const COMPOSITION_MUTATION_KEY = ["composition"] as const;

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
  return useMutation({
    ...write,
    scope: { id: "composition" },
    onMutate: async (vars: V) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<Measurement[]>(key);
      qc.setQueryData<Measurement[]>(key, (old) => byInstant(apply(old ?? [], vars)));
      return { previous, existed: exists(previous ?? [], vars) };
    },
    onSuccess: (_data, vars, ctx) => {
      toast.success(success(vars, ctx?.existed ?? false));
    },
    onError: (error, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(key, ctx.previous);
      toast.error(error instanceof DataError ? error.message : "Algo deu errado. Tente de novo.");
    },
    onSettled: () => {
      if (qc.isMutating({ mutationKey: COMPOSITION_MUTATION_KEY }) === 1) {
        return Promise.all([
          qc.invalidateQueries({ queryKey: compositionKeys.all }),
          qc.invalidateQueries({ queryKey: progressKeys.bodyWeights() }),
          qc.invalidateQueries({ queryKey: profileKeys.all }),
          // Resumo do mês e pontuações do Perfil ficam sob a chave "week".
          qc.invalidateQueries({ queryKey: weekKeys.all }),
        ]);
      }
    },
  });
}

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
