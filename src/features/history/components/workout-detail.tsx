"use client";

import { ArrowLeft, Check, Pencil, Share2, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { z } from "zod";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PrBadge } from "@/features/workout-session/components/pr-badge";
import type { PrKind } from "@/lib/domain/workout";
import { formatDay, formatKg, kgInputValue, parseDecimal, parseReps } from "@/lib/format";
import { SummaryGrid } from "@/features/workout-session/components/finish-sheet";
import type { HistoryDetail, HistoryExercise } from "../api";
import { useDeleteWorkout, useUpdateWorkoutSet, useWorkoutDetail } from "../hooks";
import { summarizeStored } from "../summary";

const uuid = z.guid();
const MAX_KG = 9999.99;

function HistoryBackLink() {
  return (
    <Link
      href="/treino/historico"
      className="-ml-2 mb-3 inline-flex min-h-11 items-center gap-1.5 rounded-md px-2 text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      <ArrowLeft aria-hidden className="size-4" />
      Histórico
    </Link>
  );
}

/** Conteúdo de /treino/historico/[id]: séries do treino, edição de carga/reps e exclusão. */
export function WorkoutDetail({ id }: { id: string }) {
  const validId = uuid.safeParse(id).success;
  const { data, isPending, isError, refetch } = useWorkoutDetail(id, validId);

  if (validId && isPending) return <WorkoutDetailSkeleton />;
  if (validId && isError) {
    return (
      <>
        <HistoryBackLink />
        <div role="alert" className="space-y-3 rounded-xl border p-5 text-sm">
          <p>Não foi possível carregar o treino.</p>
          <Button variant="outline" className="h-11" onClick={() => refetch()}>
            Tentar de novo
          </Button>
        </div>
      </>
    );
  }
  const workout = validId ? data : null;
  if (!workout) {
    return (
      <>
        <HistoryBackLink />
        <PageHeader title="Treino não encontrado" />
        <p className="text-sm text-muted-foreground">Ele pode ter sido excluído.</p>
      </>
    );
  }
  return <Detail workout={workout} />;
}

function Detail({ workout }: { workout: HistoryDetail }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const remove = useDeleteWorkout();
  const summary = summarizeStored(workout);

  return (
    <>
      <HistoryBackLink />
      <PageHeader title={workout.routine?.name ?? "Treino livre"} eyebrow="Treino finalizado">
        <Button
          variant={editing ? "default" : "outline"}
          className="h-11 shrink-0"
          aria-pressed={editing}
          onClick={() => setEditing((e) => !e)}
        >
          {editing ? <Check aria-hidden /> : <Pencil aria-hidden />}
          {editing ? "Concluir edição" : "Editar"}
        </Button>
      </PageHeader>
      <p className="-mt-3 mb-6 text-sm text-muted-foreground first-letter:uppercase">{formatDay(workout.day)}</p>

      <div className="space-y-6">
        <SummaryGrid summary={summary} />

        <Button asChild className="h-12 w-full font-semibold sm:w-auto">
          <Link href={`/treino/historico/${workout.id}/story`}>
            <Share2 aria-hidden />
            Gerar story
          </Link>
        </Button>

        <ol className="space-y-3" aria-label="Exercícios do treino">
          {workout.workout_exercises.map((exercise) => (
            <li key={exercise.id}>
              <ExerciseBlock workoutId={workout.id} exercise={exercise} editing={editing} />
            </li>
          ))}
        </ol>

        <Button variant="ghost" className="h-11 text-destructive" onClick={() => setDeleteOpen(true)}>
          <Trash2 aria-hidden />
          Excluir treino
        </Button>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Excluir este treino?"
        description="As séries saem do histórico, da evolução e dos recordes. Não dá para desfazer."
        confirmLabel="Excluir treino"
        destructive
        onConfirm={() => {
          remove.mutate(workout.id);
          router.push("/treino/historico");
        }}
      />
    </>
  );
}

function ExerciseBlock({
  workoutId,
  exercise,
  editing,
}: {
  workoutId: string;
  exercise: HistoryExercise;
  editing: boolean;
}) {
  const name = exercise.exercise?.name ?? "Exercício";
  return (
    <article aria-label={name} className="rounded-xl border bg-card p-3">
      <h2 className="mb-2 px-1 font-semibold">{name}</h2>
      <ul className="space-y-1">
        {exercise.workout_sets.map((set, i) =>
          editing ? (
            <EditableSet key={set.id} workoutId={workoutId} index={i} exerciseName={name} set={set} />
          ) : (
            <li key={set.id} className="flex min-h-9 flex-wrap items-center gap-x-3 gap-y-1 px-1 text-sm">
              <span className="num w-6 text-muted-foreground">{i + 1}</span>
              <span className="num font-medium">
                {formatKg(Number(set.weight_kg))} kg × {set.reps}
              </span>
              <PrBadge kinds={set.pr_kinds as PrKind[]} />
            </li>
          ),
        )}
      </ul>
    </article>
  );
}

type StoredSet = HistoryExercise["workout_sets"][number];

function EditableSet({
  workoutId,
  index,
  exerciseName,
  set,
}: {
  workoutId: string;
  index: number;
  exerciseName: string;
  set: StoredSet;
}) {
  const update = useUpdateWorkoutSet(workoutId);
  const [kg, setKg] = useState(kgInputValue(Number(set.weight_kg)));
  const [reps, setReps] = useState(String(set.reps));
  const kgValue = parseDecimal(kg);
  const repsValue = parseReps(reps);
  const kgInvalid = kgValue === null || kgValue > MAX_KG;
  const repsInvalid = repsValue === null;

  function save() {
    if (kgInvalid || repsInvalid) return;
    if (kgValue === Number(set.weight_kg) && repsValue === set.reps) return;
    update.mutate({ id: set.id, patch: { weight_kg: kgValue, reps: repsValue } });
  }

  const n = index + 1;
  const field =
    "num h-11 w-20 rounded-lg border border-input bg-background px-2 text-center text-base outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive dark:bg-input/30";

  return (
    <li className="flex flex-wrap items-center gap-2 px-1">
      <span className="num w-6 text-sm text-muted-foreground">{n}</span>
      <input
        aria-label={`Carga da série ${n} de ${exerciseName} (kg)`}
        inputMode="decimal"
        autoComplete="off"
        value={kg}
        aria-invalid={kgInvalid || undefined}
        onChange={(e) => setKg(e.target.value)}
        onBlur={save}
        className={field}
      />
      <span aria-hidden className="text-muted-foreground">
        ×
      </span>
      <input
        aria-label={`Repetições da série ${n} de ${exerciseName}`}
        inputMode="numeric"
        autoComplete="off"
        value={reps}
        aria-invalid={repsInvalid || undefined}
        onChange={(e) => setReps(e.target.value)}
        onBlur={save}
        className={field}
      />
      {(kgInvalid || repsInvalid) && (
        <span role="alert" className="text-xs text-destructive">
          {kgInvalid ? "Carga inválida." : "Reps: número inteiro ≥ 1."}
        </span>
      )}
    </li>
  );
}

export function WorkoutDetailSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Carregando treino">
      <Skeleton className="h-12 w-56" />
      <Skeleton className="h-20 w-full rounded-xl" />
      {Array.from({ length: 3 }, (_, i) => (
        <Skeleton key={i} className="h-32 w-full rounded-xl" />
      ))}
    </div>
  );
}
