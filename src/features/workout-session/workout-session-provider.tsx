"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { scheduleRestPush } from "@/lib/workout-push";
import { SYNC_TOAST_ID, useNow, useWorkoutHydrated, useWorkoutSync } from "./hooks";
import { useActiveWorkout } from "./store";

/** Espera entre tentativas: 2 s, 4 s, 8 s… até 1 min. */
export function retryDelayMs(attempts: number) {
  return Math.min(60_000, 2_000 * 2 ** Math.max(0, attempts - 1));
}

/**
 * Montado no layout do app: lê a sessão salva no aparelho e, se um treino finalizado
 * ainda não chegou ao servidor (`pendingSync`), reenvia com backoff e ao voltar a rede.
 * Fica em qualquer tela, então o envio acontece mesmo fora de /treino/sessao.
 */
export function WorkoutSessionProvider() {
  useEffect(() => {
    void useActiveWorkout.persist.rehydrate();
  }, []);

  return (
    <>
      <PendingSync />
      <RestNotificationWatcher />
    </>
  );
}

/** Observa o timer no layout do app para que navegar para outra tela não cancele o aviso. */
function RestNotificationWatcher() {
  const hydrated = useWorkoutHydrated();
  const rest = useActiveWorkout((s) => (hydrated ? s.workout?.rest ?? null : null));
  const workoutId = useActiveWorkout((s) => (hydrated ? s.workout?.id ?? null : null));
  const restEndsAt = rest?.endsAt;
  const restExerciseName = rest?.exerciseName;
  const restNextSetNumber = rest?.nextSetNumber;
  const now = useNow();
  const finished = rest !== null && now !== null && Date.parse(rest.endsAt) <= now;

  useEffect(() => {
    if (!hydrated || !workoutId || !restEndsAt) return;
    if (localStorage.getItem("bctrl.workout-rest-notifications") !== "enabled") return;

    void scheduleRestPush(workoutId, {
      endsAt: restEndsAt,
      exerciseName: restExerciseName,
      nextSetNumber: restNextSetNumber,
    }).catch((error: unknown) => {
      console.error("[bctrl] Não foi possível agendar o aviso push.", error);
    });
  }, [hydrated, workoutId, restEndsAt, restExerciseName, restNextSetNumber]);

  useEffect(() => {
    if (!finished || !rest) return;

    const wasNotified = localStorage.getItem("bctrl.workout-rest-last-notified") === rest.endsAt;
    if (!wasNotified) {
      localStorage.setItem("bctrl.workout-rest-last-notified", rest.endsAt);
      if (Date.now() - Date.parse(rest.endsAt) < 3_000 && "vibrate" in navigator) {
        navigator.vibrate([200, 100, 200]);
      }
    }

    useActiveWorkout.getState().skipRest();
  }, [finished, rest]);

  return null;
}

function PendingSync() {
  const hydrated = useWorkoutHydrated();
  const pending = useActiveWorkout((s) => hydrated && s.workout?.status === "pendingSync");
  // Erro do banco (não de rede) não se resolve sozinho: só com "Tentar de novo".
  const retryable = useActiveWorkout((s) => s.workout?.sync?.retryable ?? true);
  const attempts = useActiveWorkout((s) => s.workout?.sync?.attempts ?? 0);
  const { retry } = useWorkoutSync();

  useEffect(() => {
    if (!pending || !retryable) return;

    let cancelled = false;
    const run = async () => {
      if (cancelled) return;
      // Se o FinishSheet já está enviando, o store devolve o mesmo envio (sem duplicar).
      const result = await retry().catch(() => null);
      // Sem checar `cancelled`: o sucesso limpa a sessão e desmonta este efeito antes daqui.
      if (result?.status === "synced" && attempts > 0) {
        toast.success("Treino enviado. Já está no histórico.", { id: SYNC_TOAST_ID });
      }
    };

    // Sem tentativa registrada: reaberto com pendência (ou o primeiro envio ainda em curso).
    const timer = setTimeout(run, attempts === 0 ? 1_000 : retryDelayMs(attempts));
    window.addEventListener("online", run);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      window.removeEventListener("online", run);
    };
  }, [pending, retryable, attempts, retry]);

  return null;
}
