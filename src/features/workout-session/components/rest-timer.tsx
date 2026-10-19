"use client";

import { Timer } from "lucide-react";
import { useEffect } from "react";
import { formatClock } from "@/lib/format";
import { useNow } from "../hooks";
import { useActiveWorkout } from "../store";

/**
 * Descanso entre séries, fixo na parte de baixo (acima da barra de navegação no celular).
 * Calculado pelo `endsAt`: continua certo depois de recarregar ou com a tela bloqueada.
 */
export function RestTimer() {
  const rest = useActiveWorkout((s) => s.workout?.rest ?? null);
  const now = useNow();

  const remainingMs = rest && now !== null ? Date.parse(rest.endsAt) - now : null;
  const finished = remainingMs !== null && remainingMs <= 0;

  useEffect(() => {
    if (!finished || !rest) return;
    // Só vibra se acabou agora (não ao reabrir o app muito depois).
    if (Date.now() - Date.parse(rest.endsAt) < 3_000 && typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate([200, 100, 200]);
    }
    useActiveWorkout.getState().skipRest();
  }, [finished, rest]);

  if (!rest || remainingMs === null || finished) return null;

  const remainingSec = remainingMs / 1000;
  const progress = Math.min(1, Math.max(0, remainingSec / rest.durationSec));
  const { adjustRest, skipRest } = useActiveWorkout.getState();

  return (
    <div className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-30 px-3 pb-2 lg:inset-x-auto lg:right-10 lg:bottom-6 lg:w-[24rem] lg:px-0 lg:pb-0">
      <section
        aria-label="Descanso"
        className="mx-auto max-w-lg overflow-hidden rounded-2xl bg-highlight text-highlight-foreground shadow-lg"
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
          <TimerButton label="Pular descanso" onClick={() => skipRest()}>
            Pular
          </TimerButton>
        </div>
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
      className="num flex h-11 min-w-11 items-center justify-center rounded-xl bg-highlight-foreground/10 px-2.5 text-base font-semibold outline-none hover:bg-highlight-foreground/20 focus-visible:ring-[3px] focus-visible:ring-highlight-foreground/60"
    >
      {children}
    </button>
  );
}
