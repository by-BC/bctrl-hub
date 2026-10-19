"use client";

import { ChevronRight, CloudOff, Dumbbell, History, LoaderCircle, Play } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useRoutines } from "@/features/routines/hooks";
import { nextRoutineId } from "@/lib/domain/workout";
import { useLastFinishedRoutineId, useStartWorkout, useWorkoutHydrated } from "../hooks";
import { useActiveWorkout } from "../store";

/** Altura do card do treino sugerido (botões empilhados no celular): o skeleton não desloca o layout. */
export const WORKOUT_CARD_SKELETON = "h-[16.125rem] w-full rounded-2xl sm:h-[9.125rem]";

/**
 * Topo de /treino: "Continuar treino" se houver sessão no aparelho; senão, o treino
 * sugerido (próxima rotina da sequência após a última finalizada) e o treino livre.
 */
export function StartWorkoutCard({ eyebrow = "Próximo treino" }: { eyebrow?: string }) {
  const hydrated = useWorkoutHydrated();
  const workout = useActiveWorkout((s) => s.workout);

  if (!hydrated) return <Skeleton className={WORKOUT_CARD_SKELETON} />;

  if (workout) {
    const done = workout.exercises.reduce((n, e) => n + e.sets.filter((s) => s.done).length, 0);
    const pending = workout.status === "pendingSync";
    return (
      <section
        aria-labelledby="sessao-ativa-titulo"
        className="rounded-2xl border-2 border-primary/60 bg-card p-4"
        data-testid="active-workout-card"
      >
        <p className="num mb-1 flex items-center gap-1.5 text-xs tracking-[0.2em] text-primary-text uppercase">
          {pending ? <CloudOff aria-hidden className="size-3.5" /> : <Dumbbell aria-hidden className="size-3.5" />}
          {pending ? "Aguardando envio" : "Em andamento"}
        </p>
        <h2 id="sessao-ativa-titulo" className="text-xl font-bold">
          {workout.routineName ?? "Treino livre"}
        </h2>
        <p className="num mb-4 text-sm text-muted-foreground">
          {done} {done === 1 ? "série concluída" : "séries concluídas"}
        </p>
        <Button asChild className="h-12 w-full text-base font-semibold sm:w-auto">
          <Link href="/treino/sessao">
            <Play aria-hidden />
            {pending ? "Ver treino pendente" : "Continuar treino"}
          </Link>
        </Button>
      </section>
    );
  }

  return <SuggestedWorkout eyebrow={eyebrow} />;
}

function SuggestedWorkout({ eyebrow }: { eyebrow: string }) {
  const routines = useRoutines();
  const last = useLastFinishedRoutineId();
  const start = useStartWorkout();

  if (routines.isPending || last.isPending) return <Skeleton className={WORKOUT_CARD_SKELETON} />;

  const list = routines.data ?? [];
  const nextId = nextRoutineId(
    list.map((r) => ({ id: r.id, position: r.position, archivedAt: r.archived_at })),
    last.data ?? null,
  );
  const next = list.find((r) => r.id === nextId);
  const busy = start.isPending;

  return (
    <section aria-labelledby="proximo-titulo" className="rounded-2xl border bg-card p-4" data-testid="next-workout-card">
      <p className="num mb-1 text-xs tracking-[0.2em] text-muted-foreground uppercase">{eyebrow}</p>
      <h2 id="proximo-titulo" className="mb-4 text-xl font-bold">
        {next ? next.name : "Nenhuma rotina ativa"}
      </h2>
      <div className="flex flex-col gap-2 sm:flex-row">
        {next && (
          <Button
            className="h-12 text-base font-semibold"
            disabled={busy}
            onClick={() => start.mutate(next.id)}
          >
            {busy && start.variables === next.id ? (
              <LoaderCircle aria-hidden className="animate-spin" />
            ) : (
              <Play aria-hidden />
            )}
            Iniciar treino
          </Button>
        )}
        <Button variant="outline" className="h-12" disabled={busy} onClick={() => start.mutate(null)}>
          Treino livre
        </Button>
        <Button asChild variant="ghost" className="h-12 sm:ml-auto">
          <Link href="/treino/historico">
            <History aria-hidden />
            Histórico
            <ChevronRight aria-hidden className="text-muted-foreground" />
          </Link>
        </Button>
      </div>
      {last.isError && (
        <p className="mt-3 text-xs text-muted-foreground">Sem o último treino: sugerindo a primeira rotina.</p>
      )}
    </section>
  );
}

/** "Iniciar esta rotina" no editor (escolha manual fora da sequência). */
export function StartRoutineButton({ routineId }: { routineId: string }) {
  const hydrated = useWorkoutHydrated();
  const active = useActiveWorkout((s) => s.workout !== null);
  const start = useStartWorkout();

  if (hydrated && active) {
    return (
      <Button asChild variant="outline" className="h-11">
        <Link href="/treino/sessao">
          <Play aria-hidden />
          Continuar treino em andamento
        </Link>
      </Button>
    );
  }
  return (
    <Button className="h-11 font-semibold" disabled={!hydrated || start.isPending} onClick={() => start.mutate(routineId)}>
      {start.isPending ? <LoaderCircle aria-hidden className="animate-spin" /> : <Play aria-hidden />}
      Iniciar esta rotina
    </Button>
  );
}
