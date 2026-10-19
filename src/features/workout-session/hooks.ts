"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useCallback, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { DataError, routineKeys } from "@/features/routines/api";
import { historyKeys } from "@/features/history/api";
import { progressKeys } from "@/features/progress/api";
import { weekKeys } from "@/features/week/api";
import { fetchLastFinishedRoutineId, fetchSessionSeed, sendWorkout, workoutKeys } from "./api";
import { useActiveWorkout, type FinishResult } from "./store";

// ── Hidratação do store (só no cliente) ───────────────────────────────────

const subscribeHydration = (cb: () => void) => useActiveWorkout.persist.onFinishHydration(cb);

/** `true` depois que a sessão salva no aparelho foi lida (no servidor, sempre `false`). */
export function useWorkoutHydrated() {
  return useSyncExternalStore(
    subscribeHydration,
    () => useActiveWorkout.persist.hasHydrated(),
    () => false,
  );
}

// ── Relógio compartilhado (timer e duração) ───────────────────────────────

const clockListeners = new Set<() => void>();
let clockNow = 0;
let clockTimer: ReturnType<typeof setInterval> | undefined;

function subscribeClock(cb: () => void) {
  clockListeners.add(cb);
  if (!clockTimer) {
    clockNow = Date.now();
    clockTimer = setInterval(() => {
      clockNow = Date.now();
      clockListeners.forEach((l) => l());
    }, 250);
  }
  return () => {
    clockListeners.delete(cb);
    if (clockListeners.size === 0) {
      clearInterval(clockTimer);
      clockTimer = undefined;
    }
  };
}

/** Agora (ms), atualizado 4× por segundo. `null` no servidor. */
export function useNow(): number | null {
  return useSyncExternalStore(
    subscribeClock,
    () => clockNow || (clockNow = Date.now()),
    () => null,
  );
}

// ── Leituras ──────────────────────────────────────────────────────────────

export function useLastFinishedRoutineId() {
  return useQuery({ queryKey: workoutKeys.lastFinished(), queryFn: () => fetchLastFinishedRoutineId() });
}

// ── Iniciar e finalizar ───────────────────────────────────────────────────

/** Busca a rotina com anterior e recordes, monta a sessão no aparelho e abre /treino/sessao. */
export function useStartWorkout() {
  const router = useRouter();
  return useMutation({
    mutationFn: (routineId: string | null) => fetchSessionSeed(routineId),
    networkMode: "always",
    retry: false,
    onSuccess: (seed) => {
      useActiveWorkout.getState().start(seed);
      router.push("/treino/sessao");
    },
    onError: (error) => {
      toast.error(
        error instanceof DataError ? error.message : "Sem conexão para carregar a rotina. Tente de novo.",
      );
    },
  });
}

export const SYNC_TOAST_ID = "workout-sync";

/** Envio ao banco + o que precisa acontecer quando o servidor confirma. */
export function useWorkoutSync() {
  const qc = useQueryClient();

  const onResult = useCallback(
    (result: FinishResult) => {
      if (result.status === "synced") {
        return Promise.all([
          qc.invalidateQueries({ queryKey: workoutKeys.all }),
          qc.invalidateQueries({ queryKey: historyKeys.all }),
          qc.invalidateQueries({ queryKey: routineKeys.all }),
          qc.invalidateQueries({ queryKey: progressKeys.all }),
          // Treinos da semana e o pós-treino previsto.
          qc.invalidateQueries({ queryKey: weekKeys.all }),
        ]);
      }
    },
    [qc],
  );

  const finish = useCallback(async () => {
    const result = await useActiveWorkout.getState().finish((p) => sendWorkout(p));
    await onResult(result);
    return result;
  }, [onResult]);

  const retry = useCallback(async () => {
    const result = await useActiveWorkout.getState().retrySync((p) => sendWorkout(p));
    await onResult(result);
    return result;
  }, [onResult]);

  return { finish, retry };
}
