"use client";

import { Check, Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { CatalogFilters } from "@/features/exercises/components/catalog-filters";
import { CatalogRowContent, LoadMore } from "@/features/exercises/components/catalog-list";
import { useCatalogView } from "@/features/exercises/hooks";
import { hasActiveFilters } from "@/features/exercises/domain/catalog";
import { findDuplicateExercise } from "@/features/routines/domain/routines";
import type { ExerciseSummary } from "../api";
import { ExerciseForm } from "./exercise-form";

type ExercisePickerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (exercise: ExerciseSummary) => void;
  /** Exercícios já presentes (rotina ou sessão): aparecem marcados, mas podem ser escolhidos. */
  selectedIds?: readonly string[];
  title?: string;
};

/**
 * Seletor de exercício do catálogo: mesma busca e mesmos chips de músculo e equipamento
 * de /treino/exercicios, e criação de um exercício novo sem sair dali.
 * Usado no editor de rotina e na sessão de treino.
 */
export function ExercisePicker({
  open,
  onOpenChange,
  onSelect,
  selectedIds = [],
  title = "Adicionar exercício",
}: ExercisePickerProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(40rem,calc(100dvh-2rem))] flex-col gap-0 p-0">
        {/* Montado só aberto: busca e formulário sempre começam limpos. */}
        {open && (
          <PickerBody
            title={title}
            selectedIds={selectedIds}
            onSelect={(exercise) => {
              onSelect(exercise);
              onOpenChange(false);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function PickerBody({
  title,
  selectedIds,
  onSelect,
}: {
  title: string;
  selectedIds: readonly string[];
  onSelect: (exercise: ExerciseSummary) => void;
}) {
  const catalog = useCatalogView();
  const { data: exercises, isPending, isError, refetch, filters, results, shown, remaining } = catalog;
  const [creating, setCreating] = useState(false);

  const query = filters.query.trim();
  const exact = findDuplicateExercise(query, exercises ?? []);
  const selected = new Set(selectedIds);

  if (creating) {
    return (
      <>
        <DialogHeader className="border-b p-5 pr-14 text-left">
          <DialogTitle>Novo exercício</DialogTitle>
          <DialogDescription>Ele entra na sua biblioteca e já é adicionado.</DialogDescription>
        </DialogHeader>
        <div className="overflow-y-auto p-5">
          <ExerciseForm
            defaultName={exact ? "" : query}
            submitLabel="Criar e adicionar"
            onSaved={onSelect}
            onCancel={() => setCreating(false)}
          />
        </div>
      </>
    );
  }

  return (
    <>
      <DialogHeader className="min-w-0 space-y-3 border-b p-5 pr-14 pb-3 text-left">
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription className="sr-only">
          Busque no catálogo, filtre por músculo ou equipamento, ou crie um exercício novo.
        </DialogDescription>
        <CatalogFilters filters={filters} onChange={catalog.setFilters} facets={catalog.facets} />
      </DialogHeader>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="p-2">
          {isPending ? (
            <div className="space-y-2 p-2" aria-label="Carregando exercícios">
              {Array.from({ length: 5 }, (_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : isError ? (
            <div className="space-y-3 p-4 text-sm">
              <p>Não foi possível carregar os exercícios.</p>
              <Button variant="outline" className="h-11" onClick={() => refetch()}>
                Tentar de novo
              </Button>
            </div>
          ) : results.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">
              {hasActiveFilters(filters) ? "Nenhum exercício encontrado." : "Sua biblioteca ainda está vazia."}
            </p>
          ) : (
            <>
              <p className="num px-3 pb-1 text-xs text-muted-foreground" aria-live="polite">
                {results.length} {results.length === 1 ? "exercício" : "exercícios"}
              </p>
              <ul aria-label="Exercícios">
                {shown.map((exercise) => {
                  const inUse = selected.has(exercise.id);
                  return (
                    <li key={exercise.id} className="[contain-intrinsic-size:auto_4rem] [content-visibility:auto]">
                      <button
                        type="button"
                        onClick={() => onSelect(exercise)}
                        className="flex min-h-14 w-full items-center gap-3 rounded-md px-3 py-2 text-left outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
                      >
                        <CatalogRowContent
                          exercise={exercise}
                          trailing={
                            inUse && (
                              <span className="flex shrink-0 items-center gap-1 text-xs text-primary-text">
                                <Check aria-hidden className="size-3.5" />
                                Já adicionado
                              </span>
                            )
                          }
                        />
                      </button>
                    </li>
                  );
                })}
              </ul>
              <LoadMore remaining={remaining} onMore={catalog.showMore} />
            </>
          )}
        </div>
      </div>

      <div className="border-t p-3">
        <Button
          type="button"
          variant="ghost"
          className="h-11 w-full justify-start"
          onClick={() => setCreating(true)}
        >
          <Plus aria-hidden />
          {query && !exact ? <span className="truncate">Criar “{query}”</span> : "Criar exercício novo"}
        </Button>
      </div>
    </>
  );
}
