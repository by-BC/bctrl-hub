"use client";

import { ChartLine, Pencil } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { Exercise } from "@/features/routines/api";
import { exerciseMeta } from "./catalog-list";
import { ExerciseMedia } from "./exercise-media";

type ExerciseDetailSheetProps = {
  exercise: Exercise | null;
  onOpenChange: (open: boolean) => void;
  /** Abre o formulário de nome e grupo muscular. */
  onEdit?: (exercise: Exercise) => void;
};

/** Detalhe do exercício: mídia por link, instruções próprias, músculos secundários e evolução. */
export function ExerciseDetailSheet({ exercise, onOpenChange, onEdit }: ExerciseDetailSheetProps) {
  return (
    <Sheet open={exercise !== null} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 overflow-y-auto p-0 sm:max-w-md">
        {/* Montado só aberto: o vídeo (preload="none") só é pedido ao abrir o detalhe. */}
        {exercise && <DetailBody exercise={exercise} onEdit={onEdit} />}
      </SheetContent>
    </Sheet>
  );
}

function DetailBody({ exercise, onEdit }: { exercise: Exercise; onEdit?: (exercise: Exercise) => void }) {
  const meta = exerciseMeta(exercise);
  const fromHevy = exercise.source !== "bctrl" && (exercise.thumbnail_url || exercise.media_url);

  return (
    <>
      <SheetHeader className="border-b p-5 pr-14 text-left">
        <SheetTitle className="text-lg leading-snug">{exercise.name}</SheetTitle>
        <SheetDescription>{meta || "Sem grupo muscular"}</SheetDescription>
      </SheetHeader>

      <div className="space-y-6 p-5">
        <div>
          <ExerciseMedia
            key={exercise.id}
            name={exercise.name}
            muscleGroup={exercise.muscle_group}
            thumbnailUrl={exercise.thumbnail_url}
            mediaUrl={exercise.media_url}
            className="mx-auto max-w-sm"
          />
          {fromHevy && (
            <p className="mt-2 text-center text-xs text-muted-foreground">Demonstração exibida do Hevy, por link.</p>
          )}
        </div>

        <section aria-labelledby="detail-instructions" className="space-y-2">
          <h3 id="detail-instructions" className="font-semibold">
            Como executar
          </h3>
          {exercise.instructions ? (
            <p data-testid="exercise-instructions" className="text-sm leading-relaxed whitespace-pre-line">
              {exercise.instructions}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">Ainda sem instruções para este exercício.</p>
          )}
        </section>

        {exercise.secondary_muscles.length > 0 && (
          <section aria-labelledby="detail-secondary" className="space-y-2">
            <h3 id="detail-secondary" className="font-semibold">
              Músculos secundários
            </h3>
            <ul className="flex flex-wrap gap-2">
              {exercise.secondary_muscles.map((m) => (
                <li key={m} className="rounded-full bg-muted px-3 py-1 text-sm">
                  {m}
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button asChild variant="outline" className="h-11 flex-1">
            <Link href={`/evolucao/${exercise.id}`}>
              <ChartLine aria-hidden />
              Ver evolução
            </Link>
          </Button>
          {onEdit && (
            <Button type="button" variant="ghost" className="h-11" onClick={() => onEdit(exercise)}>
              <Pencil aria-hidden />
              Editar
            </Button>
          )}
        </div>
      </div>
    </>
  );
}
