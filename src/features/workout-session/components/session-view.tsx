"use client";

import { CheckCircle2, CloudOff, History, LoaderCircle, Minus, Plus, RefreshCw, Share2, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ExerciseThumb } from "@/features/exercises/components/exercise-media";
import { ExercisePicker } from "@/features/routines/components/exercise-picker";
import { BackLink } from "@/features/routines/components/back-link";
import { useCatalogExercise } from "@/features/exercises/hooks";
import { FIELDS, type ExerciseType } from "@/lib/domain/exercise-types";
import type { SessionSummary } from "@/lib/domain/workout";
import { formatElapsed } from "@/lib/format";
import { fetchExerciseSeed } from "../api";
import { SYNC_TOAST_ID, useNow, useWorkoutHydrated, useWorkoutSync } from "../hooks";
import {
  previousFor,
  summaryOf,
  useActiveWorkout,
  type ActiveWorkout,
  type FinishResult,
  type SessionExercise,
} from "../store";
import { FinishSheet, PrList, SummaryGrid, prHighlights, type PrHighlight } from "./finish-sheet";
import { RestTimer } from "./rest-timer";
import { fieldHeader, setGrid, SetRow } from "./set-row";

/** Aviso ao tocar em ✓ sem o mínimo do tipo (e sem anterior para completar). */
const MISSING_MESSAGE: Record<ExerciseType, string> = {
  weight_reps: "Digite a carga e as repetições da série.",
  reps_only: "Digite as repetições da série.",
  bodyweight_reps: "Digite as repetições da série.",
  bodyweight_assisted_reps: "Digite as repetições da série.",
  duration: "Digite a duração da série (ex.: 1:00).",
  weight_duration: "Digite a duração da série (ex.: 0:45).",
  distance_duration: "Digite a distância ou a duração da série.",
  short_distance_weight: "Digite a distância da série.",
};

type Finished = { workoutId: string; summary: SessionSummary; prs: PrHighlight[] };

/** Conteúdo de /treino/sessao: sessão ativa, pendente de envio, resumo final ou vazio. */
export function SessionView() {
  const hydrated = useWorkoutHydrated();
  const workout = useActiveWorkout((s) => s.workout);
  const [finished, setFinished] = useState<Finished | null>(null);

  if (!hydrated) return <SessionSkeleton />;

  const onFinished = (result: FinishResult, prs: PrHighlight[]) => {
    if (result.status === "synced") setFinished({ workoutId: result.workoutId, summary: result.summary, prs });
  };

  if (workout?.status === "active") return <ActiveSession workout={workout} onFinished={onFinished} />;
  if (workout?.status === "pendingSync") {
    return <PendingSession workout={workout} prs={prHighlights(workout)} />;
  }
  if (finished) return <FinishedSession finished={finished} />;
  return <EmptySession />;
}

// ── Sessão ativa ──────────────────────────────────────────────────────────

function ActiveSession({
  workout,
  onFinished,
}: {
  workout: ActiveWorkout;
  onFinished: (result: FinishResult, prs: PrHighlight[]) => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [finishOpen, setFinishOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const done = workout.exercises.reduce((n, e) => n + e.sets.filter((s) => s.done).length, 0);
  const total = workout.exercises.reduce((n, e) => n + e.sets.length, 0);

  async function addExercise(exercise: { id: string; name: string }) {
    setAdding(true);
    try {
      useActiveWorkout.getState().addExercise(await fetchExerciseSeed(exercise));
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className={workout.rest ? "pb-28 lg:pb-24" : undefined}>
      <PageHeader title={workout.routineName ?? "Treino livre"} eyebrow="Sessão">
        <Button className="h-11 shrink-0 font-semibold" onClick={() => setFinishOpen(true)}>
          <CheckCircle2 aria-hidden />
          Finalizar
        </Button>
      </PageHeader>

      <div className="-mt-3 mb-6 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
        <Elapsed startedAt={workout.startedAt} />
        <span className="num">
          {done}/{total} séries
        </span>
      </div>

      {workout.exercises.length === 0 ? (
        <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
          Treino livre: adicione o primeiro exercício.
        </div>
      ) : (
        <ol className="space-y-4" aria-label="Exercícios do treino">
          {workout.exercises.map((exercise, exIdx) => (
            <ExerciseCard key={exercise.id} exercise={exercise} exIdx={exIdx} />
          ))}
        </ol>
      )}

      <div className="mt-6 flex flex-col gap-2 sm:flex-row">
        <Button variant="outline" className="h-12 flex-1" disabled={adding} onClick={() => setPickerOpen(true)}>
          {adding ? <LoaderCircle aria-hidden className="animate-spin" /> : <Plus aria-hidden />}
          Adicionar exercício
        </Button>
        <Button variant="ghost" className="h-12 text-destructive" onClick={() => setDiscardOpen(true)}>
          <X aria-hidden />
          Descartar treino
        </Button>
      </div>

      <ExercisePicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onSelect={addExercise}
        selectedIds={workout.exercises.map((e) => e.exerciseId)}
      />
      <ConfirmDialog
        open={discardOpen}
        onOpenChange={setDiscardOpen}
        title="Descartar este treino?"
        description="As séries registradas nesta sessão serão apagadas do aparelho. Não dá para desfazer."
        confirmLabel="Descartar treino"
        destructive
        onConfirm={() => {
          useActiveWorkout.getState().discard();
          toast("Treino descartado.");
        }}
      />
      <FinishSheet workout={workout} open={finishOpen} onOpenChange={setFinishOpen} onFinished={onFinished} />
      <RestTimer />
    </div>
  );
}

function Elapsed({ startedAt }: { startedAt: string }) {
  const now = useNow();
  return (
    <span className="num" aria-label="Duração do treino">
      {now === null ? "—" : formatElapsed(now - Date.parse(startedAt))}
    </span>
  );
}

function ExerciseCard({ exercise, exIdx }: { exercise: SessionExercise; exIdx: number }) {
  const [removeOpen, setRemoveOpen] = useState(false);
  const actions = useActiveWorkout.getState();
  const hasDone = exercise.sets.some((s) => s.done);
  // Instruções próprias (RF02b) vêm do catálogo em cache; a sessão salva no aparelho não muda.
  const catalogExercise = useCatalogExercise(exercise.exerciseId);
  const instructions = catalogExercise?.instructions;

  return (
    <li>
      <article aria-label={exercise.name} data-testid="session-exercise" className="rounded-xl border bg-card p-3">
        <header className="mb-2 flex items-center gap-2">
          <ExerciseThumb
            muscleGroup={catalogExercise?.muscle_group ?? null}
            thumbnailUrl={catalogExercise?.thumbnail_url ?? null}
          />
          <h2 className="min-w-0 flex-1 py-2 pl-1 font-semibold">{exercise.name}</h2>
          <Button
            variant="ghost"
            size="icon"
            className="size-11 shrink-0 text-muted-foreground"
            aria-label={`Remover ${exercise.name} do treino`}
            onClick={() => (hasDone ? setRemoveOpen(true) : actions.removeExercise(exIdx))}
          >
            <Trash2 aria-hidden />
          </Button>
        </header>

        {exercise.notes && <Collapsed title="Observações técnicas" text={exercise.notes} />}
        {instructions && <Collapsed title="Como executar" text={instructions} testId="session-instructions" />}

        <div
          className={`${setGrid(exercise.exerciseType)} px-1 pb-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase`}
          aria-hidden
        >
          <span className="text-center">Sér.</span>
          <span>Anterior</span>
          {FIELDS[exercise.exerciseType].map((field) => (
            <span key={field} className="text-center">
              {fieldHeader(field, exercise.exerciseType)}
            </span>
          ))}
          <span className="text-center">✓</span>
        </div>
        <ul className="space-y-1" aria-label={`Séries de ${exercise.name}`}>
          {exercise.sets.map((set, setIdx) => (
            <SetRow
              key={set.id}
              index={setIdx}
              set={set}
              previous={previousFor(exercise, setIdx)}
              exerciseName={exercise.name}
              exerciseType={exercise.exerciseType}
              onChange={(patch) => actions.updateSet(exIdx, setIdx, patch)}
              onToggleWarmup={() => actions.toggleWarmup(exIdx, setIdx)}
              onToggle={() => {
                const wasDone = set.done;
                if (!actions.completeSet(exIdx, setIdx) && !wasDone) {
                  toast(MISSING_MESSAGE[exercise.exerciseType], { id: "set-empty" });
                }
              }}
            />
          ))}
        </ul>
        <p className="mt-1 px-1 text-xs text-muted-foreground">Toque no número da série para marcar aquecimento.</p>

        <div className="mt-2 flex gap-2">
          <Button variant="secondary" className="h-11 flex-1" onClick={() => actions.addSet(exIdx)}>
            <Plus aria-hidden />
            Adicionar série
          </Button>
          {exercise.sets.length > 1 && (
            <Button
              variant="ghost"
              size="icon"
              className="size-11"
              aria-label={`Remover a última série de ${exercise.name}`}
              onClick={() => actions.removeSet(exIdx, exercise.sets.length - 1)}
            >
              <Minus aria-hidden />
            </Button>
          )}
        </div>
      </article>
      <ConfirmDialog
        open={removeOpen}
        onOpenChange={setRemoveOpen}
        title={`Remover ${exercise.name}?`}
        description="As séries já concluídas deste exercício saem do treino. A rotina não muda."
        confirmLabel="Remover exercício"
        destructive
        onConfirm={() => actions.removeExercise(exIdx)}
      />
    </li>
  );
}

/** Bloco recolhido (aberto por toque): observações da rotina e instruções do exercício. */
function Collapsed({ title, text, testId }: { title: string; text: string; testId?: string }) {
  return (
    <details data-testid={testId} className="group mb-2 rounded-lg bg-muted/60 text-sm">
      <summary className="flex min-h-11 cursor-pointer list-none items-center px-3 font-medium select-none [&::-webkit-details-marker]:hidden">
        <span className="flex-1">{title}</span>
        <Plus aria-hidden className="size-4 transition-transform group-open:rotate-45" />
      </summary>
      <p className="px-3 pb-3 whitespace-pre-line text-muted-foreground">{text}</p>
    </details>
  );
}

// ── Finalizado: pendente de envio ou salvo ────────────────────────────────

function PendingSession({ workout, prs }: { workout: ActiveWorkout; prs: PrHighlight[] }) {
  const { retry } = useWorkoutSync();
  const [trying, setTrying] = useState(false);
  const sync = workout.sync;

  async function tryNow() {
    setTrying(true);
    try {
      const result = await retry();
      if (result.status === "synced") toast.success("Treino enviado. Já está no histórico.", { id: SYNC_TOAST_ID });
      else toast.error(result.error, { id: SYNC_TOAST_ID });
    } finally {
      setTrying(false);
    }
  }

  return (
    <>
      <PageHeader title={workout.routineName ?? "Treino livre"} eyebrow="Treino finalizado" />
      <div role="status" data-testid="sync-pending" className="mb-6 flex gap-3 rounded-xl border border-dashed p-4 text-sm">
        <CloudOff aria-hidden className="mt-0.5 size-5 shrink-0 text-highlight-text" />
        <div className="min-w-0 flex-1 space-y-1">
          <p className="font-semibold">Aguardando envio</p>
          <p className="text-muted-foreground">
            {sync && !sync.retryable
              ? sync.error
              : "O treino está salvo neste aparelho e será enviado assim que a conexão voltar. Não limpe os dados do navegador."}
          </p>
        </div>
      </div>
      <div className="space-y-6">
        <SummaryGrid summary={summaryOf(workout)} />
        <PrList prs={prs} />
        <Button variant="outline" className="h-11 w-full sm:w-auto" disabled={trying} onClick={tryNow}>
          {trying ? <LoaderCircle aria-hidden className="animate-spin" /> : <RefreshCw aria-hidden />}
          Tentar enviar agora
        </Button>
      </div>
    </>
  );
}

function FinishedSession({ finished }: { finished: Finished }) {
  return (
    <>
      <PageHeader title="Treino salvo" eyebrow="Resumo" />
      <div className="space-y-6">
        <SummaryGrid summary={finished.summary} />
        <PrList prs={finished.prs} />
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button asChild className="h-12 font-semibold">
            <Link href={`/treino/historico/${finished.workoutId}/story`}>
              <Share2 aria-hidden />
              Story do treino
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-12">
            <Link href={`/treino/historico/${finished.workoutId}`}>
              <History aria-hidden />
              Ver no histórico
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-12">
            <Link href="/treino">Voltar ao treino</Link>
          </Button>
        </div>
      </div>
    </>
  );
}

function EmptySession() {
  return (
    <>
      <BackLink />
      <PageHeader title="Nenhum treino em andamento" eyebrow="Sessão" />
      <p className="mb-4 text-sm text-muted-foreground">Comece pela próxima rotina da sequência ou um treino livre.</p>
      <Button asChild className="h-12 font-semibold">
        <Link href="/treino">Escolher treino</Link>
      </Button>
    </>
  );
}

function SessionSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Carregando sessão">
      <Skeleton className="h-12 w-48" />
      {Array.from({ length: 3 }, (_, i) => (
        <Skeleton key={i} className="h-48 w-full rounded-xl" />
      ))}
    </div>
  );
}
