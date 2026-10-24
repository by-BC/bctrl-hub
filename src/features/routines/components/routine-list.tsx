"use client";

import { Archive, ChevronRight, Library, RotateCcw } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { moveById, nextPosition, reorder, routineTotals } from "@/features/routines/domain/routines";
import type { RoutineListItem } from "../api";
import { useReorderRoutines, useRoutines, useSetRoutineArchived } from "../hooks";
import { NewRoutineDialog } from "./new-routine-dialog";
import { DragHandle, MoveButtons, SortableList } from "./sortable-list";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Conteúdo de /treino: rotinas ativas na ordem da sequência e as arquivadas. */
export function RoutineList() {
  const { data, isPending, isError, refetch } = useRoutines();
  const reorderRoutines = useReorderRoutines();
  const setArchived = useSetRoutineArchived();

  if (isPending) return <RoutineListSkeleton />;
  if (isError) {
    return (
      <div role="alert" className="space-y-3 rounded-xl border p-5 text-sm">
        <p>Não foi possível carregar as rotinas.</p>
        <Button variant="outline" className="h-11" onClick={() => refetch()}>
          Tentar de novo
        </Button>
      </div>
    );
  }

  const active = data.filter((r) => !r.archived_at);
  const archived = data.filter((r) => r.archived_at);

  const move = (after: RoutineListItem[]) => reorderRoutines.mutate({ before: active, after });

  return (
    <div className="space-y-8">
      <section aria-labelledby="rotinas-titulo" className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="rotinas-titulo" className="text-lg font-semibold">
              Rotinas
            </h2>
            <p className="text-sm text-muted-foreground">A sequência de treinos segue esta ordem.</p>
          </div>
          <NewRoutineDialog routines={data} />
        </div>

        {active.length === 0 ? (
          <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
            Nenhuma rotina ativa. Crie a primeira para montar a sequência.
          </div>
        ) : (
          <SortableList
            id="rotinas"
            items={active}
            getLabel={(r) => r.name}
            onMove={(from, to) => move(reorder(active, from, to))}
            className="space-y-2"
            renderItem={(routine, { index, handle, isDragging }) => {
              const totals = routineTotals(routine.routine_exercises);
              return (
                <article
                  aria-label={routine.name}
                  data-testid="routine-card"
                  className={`flex items-center gap-1 rounded-xl border bg-card py-1 pr-1 pl-1 transition-shadow ${isDragging ? "shadow-lg ring-2 ring-ring/40" : ""}`}
                >
                  <DragHandle handle={handle} label={routine.name} />
                  <Link
                    href={`/treino/rotinas/${routine.id}`}
                    className="group flex min-h-14 min-w-0 flex-1 items-center gap-3 rounded-md px-1 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  >
                    <span aria-hidden className="num w-6 shrink-0 text-sm text-muted-foreground">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{routine.name}</span>
                      <span className="num block text-xs text-muted-foreground">
                        <span className="whitespace-nowrap">
                          {plural(totals.exercises, "exercício", "exercícios")}
                        </span>{" "}
                        · <span className="whitespace-nowrap">{plural(totals.sets, "série", "séries")}</span>
                      </span>
                    </span>
                    <ChevronRight
                      aria-hidden
                      className="hidden size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 sm:block"
                    />
                  </Link>
                  <MoveButtons
                    label={routine.name}
                    index={index}
                    count={active.length}
                    onMove={(dir) => move(moveById(active, routine.id, dir))}
                  />
                </article>
              );
            }}
          />
        )}
      </section>

      <Link
        href="/treino/exercicios"
        className="flex min-h-14 items-center gap-3 rounded-xl border px-4 outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <Library aria-hidden className="size-5 text-primary-text" />
        <span className="min-w-0 flex-1">
          <span className="block font-medium">Biblioteca de exercícios</span>
          <span className="block text-xs text-muted-foreground">Buscar, criar e editar exercícios</span>
        </span>
        <ChevronRight aria-hidden className="size-4 text-muted-foreground" />
      </Link>

      {archived.length > 0 && (
        <section aria-labelledby="arquivadas-titulo" className="space-y-3">
          <h2 id="arquivadas-titulo" className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <Archive aria-hidden className="size-4" />
            Arquivadas <span className="num">({archived.length})</span>
          </h2>
          <ul className="space-y-2">
            {archived.map((routine) => (
              <li
                key={routine.id}
                className="flex items-center gap-3 rounded-xl border border-dashed py-1 pr-1 pl-4 text-sm"
              >
                <Link href={`/treino/rotinas/${routine.id}`} className="min-w-0 flex-1 truncate hover:underline">
                  {routine.name}
                </Link>
                <Button
                  variant="ghost"
                  className="h-11"
                  aria-label={`Restaurar ${routine.name}`}
                  onClick={() =>
                    setArchived.mutate({ id: routine.id, archived: false, position: nextPosition(active) })
                  }
                >
                  <RotateCcw aria-hidden />
                  Restaurar
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function RoutineListSkeleton() {
  return (
    <div className="space-y-2" aria-busy="true" aria-label="Carregando rotinas">
      <Skeleton className="mb-4 h-11 w-40" />
      {Array.from({ length: 4 }, (_, i) => (
        <Skeleton key={i} className="h-16 w-full rounded-xl" />
      ))}
    </div>
  );
}
