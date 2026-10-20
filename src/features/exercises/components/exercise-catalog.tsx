"use client";

import { Pencil, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import type { ExerciseSummary } from "@/features/routines/api";
import { ExerciseForm } from "@/features/routines/components/exercise-form";
import { hasActiveFilters } from "@/lib/domain/catalog";
import { useCatalogExercise, useCatalogView } from "../hooks";
import { CatalogFilters } from "./catalog-filters";
import { CatalogRowContent, LoadMore } from "./catalog-list";
import { ExerciseDetailSheet } from "./exercise-detail-sheet";

type Editing = { mode: "create" } | { mode: "edit"; exercise: ExerciseSummary } | null;

/** /treino/exercicios: catálogo com busca, filtros e detalhe; criar e editar continuam aqui. */
export function ExerciseCatalog() {
  const catalog = useCatalogView();
  const { data: exercises, isPending, isError, refetch, filters, results, shown, remaining } = catalog;
  const [editing, setEditing] = useState<Editing>(null);
  const [detailId, setDetailId] = useState<string>();
  const detail = useCatalogExercise(detailId);

  return (
    <div className="space-y-4">
      <CatalogFilters
        filters={filters}
        onChange={catalog.setFilters}
        facets={catalog.facets}
        actions={
          <Button className="h-11 font-semibold" onClick={() => setEditing({ mode: "create" })}>
            <Plus aria-hidden />
            Novo exercício
          </Button>
        }
      />

      {isPending ? (
        <div className="space-y-2" aria-busy="true" aria-label="Carregando exercícios">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : isError ? (
        <div role="alert" className="space-y-3 rounded-xl border p-5 text-sm">
          <p>Não foi possível carregar os exercícios.</p>
          <Button variant="outline" className="h-11" onClick={() => refetch()}>
            Tentar de novo
          </Button>
        </div>
      ) : (
        <>
          <p className="num text-xs text-muted-foreground" aria-live="polite">
            {results.length} de {exercises.length} {exercises.length === 1 ? "exercício" : "exercícios"}
          </p>
          {results.length === 0 ? (
            <p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
              {hasActiveFilters(filters) ? "Nenhum exercício encontrado." : "Sua biblioteca ainda está vazia."}
            </p>
          ) : (
            <>
              <ul aria-label="Biblioteca de exercícios" className="divide-y rounded-xl border bg-card">
                {shown.map((exercise) => (
                  <li
                    key={exercise.id}
                    data-testid="catalog-item"
                    className="flex items-center gap-1 pr-1 [contain-intrinsic-size:auto_4rem] [content-visibility:auto]"
                  >
                    <button
                      type="button"
                      onClick={() => setDetailId(exercise.id)}
                      aria-haspopup="dialog"
                      className="flex min-h-16 min-w-0 flex-1 items-center gap-3 rounded-l-xl py-2 pl-3 text-left outline-none hover:bg-accent/60 focus-visible:ring-[3px] focus-visible:ring-ring/50"
                    >
                      <CatalogRowContent exercise={exercise} />
                    </button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-11 shrink-0"
                      aria-label={`Editar ${exercise.name}`}
                      onClick={() => setEditing({ mode: "edit", exercise })}
                    >
                      <Pencil aria-hidden />
                    </Button>
                  </li>
                ))}
              </ul>
              <LoadMore remaining={remaining} onMore={catalog.showMore} />
            </>
          )}
        </>
      )}

      <ExerciseDetailSheet
        exercise={detail ?? null}
        onOpenChange={(open) => !open && setDetailId(undefined)}
        onEdit={(exercise) => {
          setDetailId(undefined);
          setEditing({ mode: "edit", exercise });
        }}
      />

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader className="pr-8 text-left">
            <DialogTitle>{editing?.mode === "edit" ? "Editar exercício" : "Novo exercício"}</DialogTitle>
            <DialogDescription>
              {editing?.mode === "edit"
                ? "O nome novo aparece em todas as rotinas e no histórico."
                : "Ele fica disponível para todas as rotinas."}
            </DialogDescription>
          </DialogHeader>
          {editing && (
            <ExerciseForm
              key={editing.mode === "edit" ? editing.exercise.id : "novo"}
              exercise={editing.mode === "edit" ? editing.exercise : undefined}
              defaultName={editing.mode === "create" ? filters.query.trim() : undefined}
              onCancel={() => setEditing(null)}
              onSaved={(saved) => {
                toast.success(editing.mode === "edit" ? "Exercício atualizado." : `${saved.name} criado.`);
                setEditing(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
