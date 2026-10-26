"use client";

import { Bell, BellOff, Timer } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { formatClock } from "@/lib/format";
import { applicationServerKeyBytes, cancelRestPush, scheduleRestPush, WORKOUT_PUSH_VAPID_PUBLIC_KEY } from "@/lib/workout-push";
import { useNow } from "../hooks";
import { useActiveWorkout } from "../store";

const subscribeNotificationSupport = () => () => {};
const getNotificationSupport = () =>
  typeof window !== "undefined" && "Notification" in window && "serviceWorker" in navigator && "PushManager" in window;
const getServerNotificationSupport = () => null;

/**
 * Descanso entre séries, fixo na parte de baixo (acima da barra de navegação no celular).
 * Calculado pelo `endsAt`: continua certo depois de recarregar ou com a tela bloqueada.
 */
export function RestTimer() {
  const rest = useActiveWorkout((s) => s.workout?.rest ?? null);
  const workoutId = useActiveWorkout((s) => s.workout?.id ?? null);
  const now = useNow();
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const notificationsAvailable = useSyncExternalStore(
    subscribeNotificationSupport,
    getNotificationSupport,
    getServerNotificationSupport,
  );

  const remainingMs = rest && now !== null ? Date.parse(rest.endsAt) - now : null;
  const finished = remainingMs !== null && remainingMs <= 0;

  useEffect(() => {
    if (notificationsAvailable !== true) return;

    let active = true;
    void navigator.serviceWorker.getRegistration("/").then(async (registration) => {
      const subscription = await registration?.pushManager.getSubscription();
      if (active) setNotificationsEnabled(Boolean(subscription && Notification.permission === "granted"));
    });
    return () => { active = false; };
  }, [notificationsAvailable]);

  async function enableNotifications() {
    if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      toast.error("Este modo do navegador não oferece Web Push.");
      return;
    }
    try {
      const permission = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
      if (permission !== "granted") {
        toast.error(permission === "denied" ? "Permita notificações do Bctrl nas configurações do navegador." : "A permissão de notificação não foi concedida.");
        return;
      }
      const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      await navigator.serviceWorker.ready;
      const subscription = (await registration.pushManager.getSubscription()) ??
        await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: applicationServerKeyBytes(WORKOUT_PUSH_VAPID_PUBLIC_KEY),
        });
      const serialized = subscription.toJSON();
      if (!serialized.keys?.p256dh || !serialized.keys.auth) {
        throw new Error("O navegador não forneceu as chaves da assinatura push.");
      }

      const response = await fetch("/api/workout-push/subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: subscription.endpoint, keys: serialized.keys }),
      });
      if (!response.ok) throw new Error("Não foi possível registrar este aparelho no servidor.");

      localStorage.setItem("bctrl.workout-rest-notifications", "enabled");
      setNotificationsEnabled(true);
      if (workoutId && rest) await scheduleRestPush(workoutId, rest);
      toast.success("Avisos push do descanso ativados neste aparelho.");
    } catch (error) {
      console.error("[bctrl] Não foi possível ativar avisos do descanso.", error);
      toast.error("Não consegui ativar o push. Confira a conexão e tente novamente.");
    }
  }

  async function disableNotifications() {
    try {
      const registration = await navigator.serviceWorker.getRegistration("/");
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        const response = await fetch("/api/workout-push/subscription", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
        if (!response.ok) throw new Error("Não foi possível remover a assinatura deste aparelho.");
        await subscription.unsubscribe();
      }
      if (workoutId) await cancelRestPush(workoutId);
      localStorage.removeItem("bctrl.workout-rest-notifications");
      setNotificationsEnabled(false);
      toast.success("Avisos desativados neste aparelho.");
    } catch (error) {
      console.error("[bctrl] Não foi possível desativar avisos push.", error);
      toast.error("Não consegui desativar os avisos. Tente novamente com conexão.");
    }
  }

  if (!rest || remainingMs === null || finished) return null;

  const remainingSec = remainingMs / 1000;
  const progress = Math.min(1, Math.max(0, remainingSec / rest.durationSec));
  const { adjustRest, skipRest } = useActiveWorkout.getState();

  function skipCurrentRest() {
    if (workoutId) {
      void cancelRestPush(workoutId).catch((error: unknown) => {
        console.error("[bctrl] Não foi possível cancelar o aviso push.", error);
      });
    }
    skipRest();
  }

  return (
    <div className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-30 px-3 pb-2 lg:inset-x-auto lg:right-10 lg:bottom-6 lg:w-[24rem] lg:px-0 lg:pb-0">
      <section
        aria-label="Descanso"
        className="mx-auto max-w-lg overflow-hidden rounded-2xl bg-highlight-surface text-highlight-foreground shadow-lg"
      >
        <div className="flex items-center gap-2 p-2 pl-4">
          <Timer aria-hidden className="size-5 shrink-0" />
          <p className="min-w-0 flex-1">
            <span className="block text-xs font-semibold tracking-wide uppercase">Descanso</span>
            <span role="timer" data-testid="rest-remaining" className="num block text-3xl leading-none font-semibold">
              {formatClock(remainingSec)}
            </span>
          </p>
          <TimerButton label="Menos 15 segundos" onClick={() => adjustRest(-15)}>
            −15
          </TimerButton>
          <TimerButton label="Mais 15 segundos" onClick={() => adjustRest(15)}>
            +15
          </TimerButton>
          <TimerButton label="Pular descanso" onClick={skipCurrentRest}>
            Pular
          </TimerButton>
        </div>
        {notificationsAvailable === true && !notificationsEnabled && (
          <button
            type="button"
            onClick={() => void enableNotifications()}
            className="flex min-h-10 w-full items-center justify-center gap-2 border-t border-highlight-foreground/15 px-3 text-sm font-medium hover:bg-highlight-foreground/10"
          >
            <Bell aria-hidden className="size-4" />
            Ativar aviso no celular ao fim do descanso
          </button>
        )}
        {notificationsAvailable === true && notificationsEnabled && (
          <button
            type="button"
            onClick={() => void disableNotifications()}
            className="flex min-h-10 w-full items-center justify-center gap-2 border-t border-highlight-foreground/15 px-3 text-sm font-medium hover:bg-highlight-foreground/10"
          >
            <BellOff aria-hidden className="size-4" />
            Desativar aviso neste aparelho
          </button>
        )}
        {notificationsAvailable === false && (
          <p className="border-t border-highlight-foreground/15 px-3 py-2 text-center text-xs">
            Abra o Bctrl pela versão instalada na Tela de Início para ativar avisos push.
          </p>
        )}
        <div aria-hidden className="h-1.5 bg-highlight-foreground/15">
          <div
            className="h-full origin-left bg-highlight-foreground/70 transition-transform duration-300 ease-linear"
            style={{ transform: `scaleX(${progress})` }}
          />
        </div>
      </section>
    </div>
  );
}

function TimerButton({ label, onClick, children }: { label: string; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="num flex h-11 min-w-11 items-center justify-center rounded-xl bg-highlight-foreground/10 px-2.5 text-base font-semibold outline-none hover:bg-highlight-foreground/15 focus-visible:ring-[3px] focus-visible:ring-highlight-foreground/60"
    >
      {children}
    </button>
  );
}
