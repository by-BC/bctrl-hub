"use client";

import { Pencil, Plus, Search } from "lucide-react";
import { useId, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { filterExercises } from "@/lib/domain/routines";
import type { ExerciseSummary } from "../api";
import { useExercises } from "../hooks";
import { ExerciseForm } from "./exercise-form";

type Editing = { mode: "create" } | { mode: "edit"; exercise: ExerciseSummary } | null;

/** /treino/exercicios: buscar, criar e editar exercícios da biblioteca. */
export function ExerciseLibrary() {
  const searchId = useId();
  const { data: exercises, isPending, isError, refetch } = useExercises();
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Editing>(null);

  const results = filterExercises(exercises ?? [], query);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
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
        <Button className="h-11 font-semibold" onClick={() => setEditing({ mode: "create" })}>
          <Plus aria-hidden />
          Novo exercício
        </Button>
      </div>

      {isPending ? (
        <div className="space-y-2" aria-busy="true" aria-label="Carregando exercícios">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-xl" />
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
              {query.trim() ? "Nenhum exercício encontrado." : "Sua biblioteca ainda está vazia."}
            </p>
          ) : (
            <ul aria-label="Biblioteca de exercícios" className="divide-y rounded-xl border bg-card">
              {results.map((exercise) => (
                <li key={exercise.id} className="flex items-center gap-3 py-1 pr-1 pl-4">
                  <div className="min-w-0 flex-1 py-1.5">
                    <p className="truncate font-medium">{exercise.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {exercise.muscle_group ?? "Sem grupo muscular"}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-11"
                    aria-label={`Editar ${exercise.name}`}
                    onClick={() => setEditing({ mode: "edit", exercise })}
                  >
                    <Pencil aria-hidden />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

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
              defaultName={editing.mode === "create" ? query.trim() : undefined}
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
