"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { exerciseFormSchema, firstError } from "@/lib/schemas/routine";
import type { Exercise, ExerciseSummary } from "../api";
import { mutationErrorMessage, useCreateExercise, useExercises, useUpdateExercise } from "../hooks";

type ExerciseFormProps = {
  /** Sem `exercise`: cria um novo. */
  exercise?: ExerciseSummary;
  defaultName?: string;
  submitLabel?: string;
  onSaved: (exercise: ExerciseSummary) => void;
  onCancel?: () => void;
};

/** Nome + grupo muscular. Recusa nome repetido com mensagem clara. */
export function ExerciseForm({ exercise, defaultName = "", submitLabel, onSaved, onCancel }: ExerciseFormProps) {
  const ids = { name: useId(), group: useId(), groups: useId(), error: useId() };
  const { data: exercises = [] } = useExercises();
  const create = useCreateExercise();
  const update = useUpdateExercise();
  const [error, setError] = useState<string | null>(null);
  const pending = create.isPending || update.isPending;

  const groups = [...new Set(exercises.map((e) => e.muscle_group).filter((g): g is string => !!g))].sort();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const parsed = exerciseFormSchema.safeParse({
      name: String(form.get("name") ?? ""),
      muscle_group: String(form.get("muscle_group") ?? ""),
    });
    if (!parsed.success) {
      setError(firstError(parsed.error));
      return;
    }
    setError(null);
    try {
      const row: Pick<Exercise, "id" | "name" | "muscle_group"> = {
        id: exercise?.id ?? crypto.randomUUID(),
        ...parsed.data,
      };
      if (exercise) await update.mutateAsync(row);
      else await create.mutateAsync(row);
      onSaved(row);
    } catch (e) {
      setError(mutationErrorMessage(e));
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div className="space-y-2">
        <Label htmlFor={ids.name}>Nome do exercício</Label>
        <Input
          id={ids.name}
          name="name"
          defaultValue={exercise?.name ?? defaultName}
          autoComplete="off"
          required
          maxLength={120}
          className="h-11 text-base"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? ids.error : undefined}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={ids.group}>
          Grupo muscular <span className="font-normal text-muted-foreground">(opcional)</span>
        </Label>
        <Input
          id={ids.group}
          name="muscle_group"
          list={ids.groups}
          defaultValue={exercise?.muscle_group ?? ""}
          autoComplete="off"
          maxLength={60}
          placeholder="Ex.: Peito"
          className="h-11 text-base"
        />
        <datalist id={ids.groups}>
          {groups.map((g) => (
            <option key={g} value={g} />
          ))}
        </datalist>
      </div>

      <p id={ids.error} role="alert" aria-live="polite" className="min-h-5 text-sm text-destructive">
        {error}
      </p>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {onCancel && (
          <Button type="button" variant="outline" className="h-11" onClick={onCancel}>
            Cancelar
          </Button>
        )}
        <Button type="submit" className="h-11 font-semibold" disabled={pending}>
          {pending ? "Salvando…" : (submitLabel ?? (exercise ? "Salvar exercício" : "Criar exercício"))}
        </Button>
      </div>
    </form>
  );
}
