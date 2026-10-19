"use client";

import { onlineManager, useMutationState } from "@tanstack/react-query";
import { CloudOff, RefreshCw } from "lucide-react";
import { useSyncExternalStore } from "react";
import { useWorkoutHydrated } from "@/features/workout-session/hooks";
import { useActiveWorkout } from "@/features/workout-session/store";
import { cn } from "@/lib/utils";

export type SyncView =
  | { kind: "idle" }
  | { kind: "offline"; pending: number }
  | { kind: "syncing"; pending: number };

/**
 * O que o indicador mostra (puro, testável).
 * - `pending`: gravações ainda não confirmadas pelo servidor.
 * - `stalled`: dessas, as que esperam rede (pausadas) ou já falharam e vão repetir.
 * Gravação rápida com rede não acende nada: só aparece quando há algo esperando.
 */
export function syncView({ online, pending, stalled }: { online: boolean; pending: number; stalled: number }): SyncView {
  if (!online) return { kind: "offline", pending };
  if (stalled > 0) return { kind: "syncing", pending };
  return { kind: "idle" };
}

export function pendingLabel(n: number) {
  return n === 1 ? "1 pendente" : `${n} pendentes`;
}

export function syncText(view: SyncView): string {
  switch (view.kind) {
    case "offline":
      return view.pending > 0 ? `Offline · ${pendingLabel(view.pending)}` : "Offline";
    case "syncing":
      return `Sincronizando · ${pendingLabel(view.pending)}`;
    default:
      return "";
  }
}

function useOnline() {
  return useSyncExternalStore(
    (cb) => onlineManager.subscribe(cb),
    () => onlineManager.isOnline(),
    () => true,
  );
}

const noopSubscribe = () => () => {};

/** `false` no servidor e na hidratação: o HTML do servidor sempre sai "idle". */
function useHydrated() {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}

/** Gravações da fila (TanStack) e o treino finalizado à espera de envio (fila própria). */
function useSyncView(): SyncView {
  const hydrated = useHydrated();
  const online = useOnline();
  const mutations = useMutationState({
    filters: { status: "pending" },
    select: (m) => m.state.isPaused || m.state.failureCount > 0,
  });
  const workoutHydrated = useWorkoutHydrated();
  const workoutPending = useActiveWorkout((s) => workoutHydrated && s.workout?.status === "pendingSync");

  const stalled = mutations.filter(Boolean).length + (workoutPending ? 1 : 0);
  const pending = mutations.length + (workoutPending ? 1 : 0);
  if (!hydrated) return { kind: "idle" };
  return syncView({ online, pending, stalled });
}

/**
 * Estado da sincronização no topo do app: offline, sincronizando e quantas gravações faltam.
 * Texto + ícone (não só cor) numa região `aria-live`, para o leitor de tela anunciar a mudança.
 */
export function SyncStatus({ className }: { className?: string }) {
  const view = useSyncView();
  return (
    <div role="status" aria-live="polite" className={className} data-testid="sync-status" data-state={view.kind}>
      {view.kind !== "idle" && (
        <span
          className={cn(
            "inline-flex min-h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium",
            view.kind === "offline" ? "bg-muted text-foreground" : "bg-background text-primary-text",
          )}
        >
          {view.kind === "offline" ? (
            <CloudOff aria-hidden className="size-4 shrink-0" />
          ) : (
            <RefreshCw aria-hidden className="size-4 shrink-0 animate-spin" />
          )}
          {syncText(view)}
        </span>
      )}
    </div>
  );
}
