"use client";

import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { DataError, routineKeys } from "@/features/routines/api";
import { workoutKeys } from "@/features/workout-session/api";
import {
  deleteWorkout,
  fetchHistory,
  fetchWorkoutDetail,
  historyKeys,
  updateWorkoutSet,
  type HistoryDetail,
  type HistoryListItem,
} from "./api";

export function useHistory() {
  return useQuery({ queryKey: historyKeys.list(), queryFn: fetchHistory });
}

export function useWorkoutDetail(id: string, enabled = true) {
  return useQuery({ queryKey: historyKeys.detail(id), queryFn: () => fetchWorkoutDetail(id), enabled });
}

const HISTORY_MUTATION_KEY = ["history"] as const;

type Snapshot = { list?: HistoryListItem[]; detail?: HistoryDetail | null; id: string };

async function snapshot(qc: QueryClient, id: string): Promise<Snapshot> {
  await qc.cancelQueries({ queryKey: historyKeys.all });
  return {
    list: qc.getQueryData<HistoryListItem[]>(historyKeys.list()),
    detail: qc.getQueryData<HistoryDetail | null>(historyKeys.detail(id)),
    id,
  };
}

/**
 * Mesmo padrão das rotinas: otimismo no `onMutate`, desfaz no erro e revalida quando a
 * última gravação da fila termina. O `scope` serializa as edições em ordem.
 */
function historyMutationOptions(qc: QueryClient) {
  return {
    mutationKey: HISTORY_MUTATION_KEY,
    scope: { id: "history" },
    onError: (error: unknown, _vars: unknown, snap: Snapshot | undefined) => {
      if (snap?.list) qc.setQueryData(historyKeys.list(), snap.list);
      if (snap && snap.detail !== undefined) qc.setQueryData(historyKeys.detail(snap.id), snap.detail);
      toast.error(error instanceof DataError ? error.message : "Algo deu errado. Tente de novo.");
    },
    onSettled: () => {
      if (qc.isMutating({ mutationKey: HISTORY_MUTATION_KEY }) === 1) {
        return Promise.all([
          qc.invalidateQueries({ queryKey: historyKeys.all }),
          // Anterior, recordes e o próximo treino sugerido dependem do histórico.
          qc.invalidateQueries({ queryKey: workoutKeys.all }),
        ]);
      }
    },
  };
}

type SetPatch = { weight_kg: number; reps: number };

export function useUpdateWorkoutSet(workoutId: string) {
  const qc = useQueryClient();
  return useMutation({
    ...historyMutationOptions(qc),
    mutationFn: ({ id, patch }: { id: string; patch: SetPatch }) => updateWorkoutSet(id, patch),
    onMutate: async ({ id, patch }) => {
      const snap = await snapshot(qc, workoutId);
      qc.setQueryData<HistoryDetail | null>(historyKeys.detail(workoutId), (old) =>
        old
          ? {
              ...old,
              workout_exercises: old.workout_exercises.map((e) => ({
                ...e,
                workout_sets: e.workout_sets.map((s) => (s.id === id ? { ...s, ...patch } : s)),
              })),
            }
          : old,
      );
      return snap;
    },
  });
}

export function useDeleteWorkout() {
  const qc = useQueryClient();
  return useMutation({
    ...historyMutationOptions(qc),
    mutationFn: (id: string) => deleteWorkout(id),
    onMutate: async (id) => {
      const snap = await snapshot(qc, id);
      qc.setQueryData<HistoryListItem[]>(historyKeys.list(), (old) => old?.filter((w) => w.id !== id));
      return snap;
    },
    onSuccess: (_data, id) => {
      qc.removeQueries({ queryKey: historyKeys.detail(id) });
      // A rotina pode voltar a poder ser excluída.
      return qc.invalidateQueries({ queryKey: routineKeys.all });
    },
  });
}
