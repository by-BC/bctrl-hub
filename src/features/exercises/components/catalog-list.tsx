"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { equipmentLabel } from "@/lib/domain/catalog";
import type { Exercise } from "@/features/routines/api";
import { ExerciseThumb } from "./exercise-media";

export type CatalogExercise = Pick<Exercise, "id" | "name" | "muscle_group"> &
  Partial<Pick<Exercise, "equipment" | "thumbnail_url">>;

/** "Peito · Halter" (o que existir). */
export function exerciseMeta(exercise: CatalogExercise): string {
  return [exercise.muscle_group, exercise.equipment && equipmentLabel(exercise.equipment)]
    .filter(Boolean)
    .join(" · ");
}

/** Miniatura + nome + músculo/equipamento: o miolo de cada linha do catálogo. */
export function CatalogRowContent({ exercise, trailing }: { exercise: CatalogExercise; trailing?: React.ReactNode }) {
  const meta = exerciseMeta(exercise);
  return (
    <>
      <ExerciseThumb
        muscleGroup={exercise.muscle_group}
        thumbnailUrl={exercise.thumbnail_url ?? null}
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{exercise.name}</span>
        <span className="block truncate text-xs text-muted-foreground">{meta || "Sem grupo muscular"}</span>
      </span>
      {trailing}
    </>
  );
}

/**
 * Paginação no cliente: carrega o próximo bloco quando o fim da lista se aproxima
 * e mantém um botão para quem navega por teclado ou leitor de tela.
 */
export function LoadMore({ remaining, onMore }: { remaining: number; onMore: () => void }) {
  const sentinel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = sentinel.current;
    if (!el || remaining <= 0 || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && onMore(), {
      rootMargin: "400px 0px",
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [remaining, onMore]);

  if (remaining <= 0) return null;
  return (
    <div ref={sentinel} className="pt-2">
      <Button type="button" variant="ghost" className="h-11 w-full" onClick={onMore}>
        <ChevronDown aria-hidden />
        Mostrar mais <span className="num">({remaining})</span>
      </Button>
    </div>
  );
}
