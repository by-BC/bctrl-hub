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
import { WarmupBadge } from "@/features/workout-session/components/set-row";
import { FIELDS, isSetComplete, toExerciseType, type ExerciseType, type SetField } from "@/lib/domain/exercise-types";
import type { PrKind } from "@/lib/domain/workout";
import {
  durationInputValue,
  formatDay,
  formatSet,
  kgInputValue,
  kmInputValue,
  parseDecimal,
  parseDuration,
  parseKm,
  parseReps,
} from "@/lib/format";
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
            Criar story do treino
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
  const type = toExerciseType(exercise.exercise?.exercise_type);
  return (
    <article aria-label={name} className="rounded-xl border bg-card p-3">
      <h2 className="mb-2 px-1 font-semibold">{name}</h2>
      <ul className="space-y-1">
        {exercise.workout_sets.map((set, i) =>
          editing ? (
            <EditableSet key={set.id} workoutId={workoutId} index={i} exerciseName={name} type={type} set={set} />
          ) : (
            <li
              key={set.id}
              data-testid="history-set"
              className="flex min-h-9 flex-wrap items-center gap-x-3 gap-y-1 px-1 text-sm"
            >
              <span className="num w-6 text-muted-foreground">{i + 1}</span>
              <span className="num font-medium">{formatSet(storedValues(set), type)}</span>
              {set.set_type === "warmup" && <WarmupBadge />}
              <PrBadge kinds={set.pr_kinds as PrKind[]} />
            </li>
          ),
        )}
      </ul>
    </article>
  );
}

type StoredSet = HistoryExercise["workout_sets"][number];
type Values = Record<SetField, number | null>;

/** numeric chega do PostgREST como número (ou texto): normaliza para os campos da série. */
function storedValues(set: StoredSet) {
  return {
    weightKg: set.weight_kg === null ? null : Number(set.weight_kg),
    reps: set.reps,
    distanceM: set.distance_m === null ? null : Number(set.distance_m),
    durationS: set.duration_s,
  };
}

const EDIT_FIELDS: Record<
  SetField,
  {
    column: "weight_kg" | "reps" | "distance_m" | "duration_s";
    label: (n: number, e: string) => string;
    inputMode: "decimal" | "numeric" | "text";
    toText: (v: number | null) => string;
    parse: (t: string) => number | null;
    max?: number;
  }
> = {
  weight: {
    column: "weight_kg",
    label: (n, e) => `Carga da série ${n} de ${e} (kg)`,
    inputMode: "decimal",
    toText: kgInputValue,
    parse: parseDecimal,
    max: MAX_KG,
  },
  reps: {
    column: "reps",
    label: (n, e) => `Repetições da série ${n} de ${e}`,
    inputMode: "numeric",
    toText: (v) => (v === null ? "" : String(v)),
    parse: parseReps,
  },
  distance: {
    column: "distance_m",
    label: (n, e) => `Distância da série ${n} de ${e} (km)`,
    inputMode: "decimal",
    toText: kmInputValue,
    parse: parseKm,
  },
  duration: {
    column: "duration_s",
    label: (n, e) => `Duração da série ${n} de ${e} (minutos:segundos)`,
    inputMode: "text",
    toText: durationInputValue,
    parse: parseDuration,
  },
};

/** Edição de uma série gravada, com os campos do tipo do exercício. Salva ao sair do campo. */
function EditableSet({
  workoutId,
  index,
  exerciseName,
  type,
  set,
}: {
  workoutId: string;
  index: number;
  exerciseName: string;
  type: ExerciseType;
  set: StoredSet;
}) {
  const update = useUpdateWorkoutSet(workoutId);
  const stored = storedValues(set);
  const initial: Values = { weight: stored.weightKg, reps: stored.reps, distance: stored.distanceM, duration: stored.durationS };
  const fields = FIELDS[type];
  const [texts, setTexts] = useState<Record<SetField, string>>(() =>
    Object.fromEntries(fields.map((f) => [f, EDIT_FIELDS[f].toText(initial[f])])) as Record<SetField, string>,
  );
  const values = Object.fromEntries(
    fields.map((f) => {
      const text = texts[f] ?? "";
      return [f, text.trim() === "" ? null : EDIT_FIELDS[f].parse(text)];
    }),
  ) as Values;
  const fieldInvalid = (f: SetField) => {
    const text = texts[f] ?? "";
    const max = EDIT_FIELDS[f].max;
    return (text.trim() !== "" && values[f] === null) || (max !== undefined && (values[f] ?? 0) > max);
  };
  const complete = isSetComplete(type, {
    weightKg: values.weight ?? null,
    reps: values.reps ?? null,
    distanceM: values.distance ?? null,
    durationS: values.duration ?? null,
  });
  const invalid = !complete || fields.some(fieldInvalid);

  function save() {
    if (invalid) return;
    if (fields.every((f) => values[f] === initial[f])) return;
    const patch = Object.fromEntries(fields.map((f) => [EDIT_FIELDS[f].column, values[f]]));
    update.mutate({ id: set.id, patch });
  }

  const n = index + 1;
  const field =
    "num h-11 w-20 rounded-lg border border-input bg-background px-2 text-center text-base outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive dark:bg-input/30";

  return (
    <li className="flex flex-wrap items-center gap-2 px-1">
      <span className="num w-6 text-sm text-muted-foreground">{n}</span>
      {fields.map((f, i) => (
        <span key={f} className="contents">
          {i > 0 && (
            <span aria-hidden className="text-muted-foreground">
              {fields.includes("reps") ? "×" : "·"}
            </span>
          )}
          <input
            aria-label={EDIT_FIELDS[f].label(n, exerciseName)}
            inputMode={EDIT_FIELDS[f].inputMode}
            autoComplete="off"
            value={texts[f]}
            aria-invalid={fieldInvalid(f) || (!complete && values[f] === null) || undefined}
            onChange={(e) => setTexts((t) => ({ ...t, [f]: e.target.value }))}
            onBlur={save}
            className={field}
          />
        </span>
      ))}
      {set.set_type === "warmup" && <WarmupBadge />}
      {invalid && (
        <span role="alert" className="text-xs text-destructive">
          {INVALID_MESSAGE[type]}
        </span>
      )}
    </li>
  );
}

const INVALID_MESSAGE: Record<ExerciseType, string> = {
  weight_reps: "Carga e reps (inteiro ≥ 1) obrigatórias.",
  reps_only: "Reps: número inteiro ≥ 1.",
  bodyweight_reps: "Reps: número inteiro ≥ 1; carga extra opcional.",
  bodyweight_assisted_reps: "Reps: número inteiro ≥ 1; assistência opcional.",
  duration: "Duração no formato m:ss (ex.: 1:00).",
  weight_duration: "Duração no formato m:ss; carga opcional.",
  distance_duration: "Informe a distância (km) ou a duração (m:ss).",
  short_distance_weight: "Informe a distância (km); carga opcional.",
};

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
