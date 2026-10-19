"use client";

import { Check, Plus, Search } from "lucide-react";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { filterExercises, findDuplicateExercise } from "@/lib/domain/routines";
import type { ExerciseSummary } from "../api";
import { useExercises } from "../hooks";
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
 * Seletor de exercício da biblioteca: busca por nome/grupo e cria um novo sem sair dali.
 * Usado no editor de rotina e na sessão de treino (task 4.0).
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
  const searchId = useId();
  const { data: exercises, isPending, isError, refetch } = useExercises();
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);

  const results = filterExercises(exercises ?? [], query);
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
            defaultName={exact ? "" : query.trim()}
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
      <DialogHeader className="space-y-3 border-b p-5 pr-14 text-left">
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription className="sr-only">Busque na sua biblioteca ou crie um exercício novo.</DialogDescription>
        <div className="relative">
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <label htmlFor={searchId} className="sr-only">
            Buscar exercício
          </label>
          <Input
            id={searchId}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nome ou grupo"
            autoComplete="off"
            className="h-11 pl-9 text-base"
          />
        </div>
      </DialogHeader>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {isPending ? (
          <div className="space-y-2 p-2" aria-label="Carregando exercícios">
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
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
            {query.trim() ? "Nenhum exercício encontrado." : "Sua biblioteca ainda está vazia."}
          </p>
        ) : (
          <ul aria-label="Exercícios">
            {results.map((exercise) => {
              const inUse = selected.has(exercise.id);
              return (
                <li key={exercise.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(exercise)}
                    className="flex min-h-12 w-full items-center gap-3 rounded-md px-3 py-2 text-left outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{exercise.name}</span>
                      {exercise.muscle_group && (
                        <span className="block truncate text-xs text-muted-foreground">{exercise.muscle_group}</span>
                      )}
                    </span>
                    {inUse && (
                      <span className="flex shrink-0 items-center gap-1 text-xs text-primary-text">
                        <Check aria-hidden className="size-3.5" />
                        Já adicionado
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="border-t p-3">
        <Button
          type="button"
          variant="ghost"
          className="h-11 w-full justify-start"
          onClick={() => setCreating(true)}
        >
          <Plus aria-hidden />
          {query.trim() && !exact ? (
            <span className="truncate">Criar “{query.trim()}”</span>
          ) : (
            "Criar exercício novo"
          )}
        </Button>
      </div>
    </>
  );
}
