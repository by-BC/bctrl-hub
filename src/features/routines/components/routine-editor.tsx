"use client";

import { useIsMutating } from "@tanstack/react-query";
import { Archive, Check, LoaderCircle, Plus, RotateCcw, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StartRoutineButton } from "@/features/workout-session/components/start-workout-card";
import { formatRest, moveById, nextPosition, reorder, routineTotals } from "@/lib/domain/routines";
import {
  firstError,
  REST_MAX,
  REST_MIN,
  REST_STEP,
  routineExerciseFormSchema,
  routineFormSchema,
  SETS_MAX,
  SETS_MIN,
} from "@/lib/schemas/routine";
import type { RoutineDetail, RoutineItem } from "../api";
import {
  newRoutineItem,
  ROUTINE_MUTATION_KEY,
  useAddRoutineExercise,
  useRemoveRoutineExercise,
  useReorderRoutineExercises,
  useRoutine,
  useRoutines,
  useSetRoutineArchived,
  useUpdateRoutine,
  useUpdateRoutineExercise,
} from "../hooks";
import { BackLink } from "./back-link";
import { BlurSaveField } from "./blur-save-field";
import { ExercisePicker } from "./exercise-picker";
import { RoutineActionsDialog } from "./routine-actions-dialog";
import { DragHandle, MoveButtons, SortableList, type DragHandleProps } from "./sortable-list";
import { Stepper } from "./stepper";

// z.guid(): os ids do seed vêm de md5 (formato de uuid, sem versão RFC).
const uuid = z.guid();

export function RoutineEditor({ id }: { id: string }) {
  // Id malformado nem vai ao banco: cai direto em "não encontrada".
  const validId = uuid.safeParse(id).success;
  const { data, isPending, isError, refetch } = useRoutine(id, validId);
  const routine = validId ? data : null;

  if (validId && isPending) return <EditorSkeleton />;
  if (validId && isError) {
    return (
      <>
        <BackLink />
        <div role="alert" className="space-y-3 rounded-xl border p-5 text-sm">
          <p>Não foi possível carregar a rotina.</p>
          <Button variant="outline" className="h-11" onClick={() => refetch()}>
            Tentar de novo
          </Button>
        </div>
      </>
    );
  }
  if (!routine) {
    return (
      <>
        <BackLink />
        <PageHeader title="Rotina não encontrada" />
        <p className="text-sm text-muted-foreground">Ela pode ter sido excluída.</p>
      </>
    );
  }
  return <Editor routine={routine} />;
}

function Editor({ routine }: { routine: RoutineDetail }) {
  const updateRoutine = useUpdateRoutine(routine.id);
  const addExercise = useAddRoutineExercise(routine.id);
  const reorderItems = useReorderRoutineExercises(routine.id);
  const setArchived = useSetRoutineArchived();
  const { data: allRoutines = [] } = useRoutines();
  const [pickerOpen, setPickerOpen] = useState(false);

  const items = routine.routine_exercises;
  const totals = routineTotals(items);
  const archived = !!routine.archived_at;

  const saveRoutine = (patch: Partial<Pick<RoutineDetail, "name" | "notes" | "rest_sec">>) => {
    const parsed = routineFormSchema.safeParse({
      name: routine.name,
      notes: routine.notes,
      rest_sec: routine.rest_sec,
      ...patch,
    });
    if (!parsed.success) return firstError(parsed.error);
    const clean = Object.fromEntries(Object.keys(patch).map((k) => [k, parsed.data[k as keyof typeof patch]]));
    updateRoutine.mutate(clean);
    return null;
  };

  const move = (after: RoutineItem[]) => reorderItems.mutate({ before: items, after });

  return (
    <>
      <BackLink />
      <PageHeader title={routine.name} eyebrow="Rotina">
        <SaveStatus />
      </PageHeader>

      {archived && (
        <div
          role="status"
          className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-dashed p-4 text-sm"
        >
          <Archive aria-hidden className="size-4 text-muted-foreground" />
          <p className="min-w-0 flex-1">Rotina arquivada: fora da sequência de treinos.</p>
          <Button
            variant="outline"
            className="h-11"
            onClick={() =>
              setArchived.mutate({
                id: routine.id,
                archived: false,
                position: nextPosition(allRoutines.filter((r) => !r.archived_at)),
              })
            }
          >
            <RotateCcw aria-hidden />
            Restaurar
          </Button>
        </div>
      )}

      {!archived && items.length > 0 && (
        <div className="mb-6">
          <StartRoutineButton routineId={routine.id} />
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] lg:items-start">
        <section aria-labelledby="detalhes-titulo" className="space-y-4 rounded-xl border bg-card p-4">
          <h2 id="detalhes-titulo" className="font-semibold">
            Detalhes
          </h2>
          <BlurSaveField
            label="Nome da rotina"
            value={routine.name}
            maxLength={120}
            onSave={(name) => saveRoutine({ name })}
          />
          <Stepper
            label="Descanso padrão"
            value={routine.rest_sec}
            min={REST_MIN}
            max={REST_MAX}
            step={REST_STEP}
            format={formatRest}
            onChange={(rest_sec) => saveRoutine({ rest_sec })}
          />
          <BlurSaveField
            label="Observações da rotina"
            value={routine.notes ?? ""}
            multiline
            maxLength={2000}
            placeholder="Ex.: aquecer ombros antes do supino"
            onSave={(notes) => saveRoutine({ notes })}
          />
        </section>

        <section aria-labelledby="exercicios-titulo" className="space-y-3">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 id="exercicios-titulo" className="text-lg font-semibold">
                Exercícios
              </h2>
              <p className="num text-xs text-muted-foreground">
                {totals.exercises} {totals.exercises === 1 ? "exercício" : "exercícios"} · {totals.sets}{" "}
                {totals.sets === 1 ? "série" : "séries"}
              </p>
            </div>
            <Button className="h-11 font-semibold" onClick={() => setPickerOpen(true)}>
              <Plus aria-hidden />
              Adicionar exercício
            </Button>
          </div>

          {items.length === 0 ? (
            <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
              Nenhum exercício ainda. Adicione o primeiro da sua biblioteca ou crie um novo.
            </div>
          ) : (
            <SortableList
              id={`rotina-${routine.id}`}
              items={items}
              getLabel={(i) => i.exercise.name}
              onMove={(from, to) => move(reorder(items, from, to))}
              className="space-y-3"
              renderItem={(item, { index, handle, isDragging }) => (
                <RoutineItemCard
                  item={item}
                  index={index}
                  count={items.length}
                  routine={routine}
                  handle={handle}
                  isDragging={isDragging}
                  onMove={(dir) => move(moveById(items, item.id, dir))}
                />
              )}
            />
          )}
        </section>
      </div>

      {!archived && (
        <div className="mt-10 border-t pt-6">
          <RoutineActionsDialog routine={routine} />
        </div>
      )}

      <ExercisePicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        selectedIds={items.map((i) => i.exercise_id)}
        onSelect={(exercise) => addExercise.mutate(newRoutineItem(routine, exercise))}
      />
    </>
  );
}

function RoutineItemCard({
  item,
  index,
  count,
  routine,
  handle,
  isDragging,
  onMove,
}: {
  item: RoutineItem;
  index: number;
  count: number;
  routine: RoutineDetail;
  handle: DragHandleProps;
  isDragging: boolean;
  onMove: (direction: -1 | 1) => void;
}) {
  const update = useUpdateRoutineExercise(routine.id);
  const remove = useRemoveRoutineExercise(routine.id);
  const name = item.exercise.name;

  const save = (patch: Partial<Pick<RoutineItem, "sets" | "rest_sec" | "notes">>) => {
    const parsed = routineExerciseFormSchema.safeParse({
      sets: item.sets,
      rest_sec: item.rest_sec,
      notes: item.notes,
      ...patch,
    });
    if (!parsed.success) return firstError(parsed.error);
    const clean = Object.fromEntries(Object.keys(patch).map((k) => [k, parsed.data[k as keyof typeof patch]]));
    update.mutate({ id: item.id, patch: clean });
    return null;
  };

  return (
    <article
      aria-label={name}
      data-testid="routine-item"
      className={`space-y-3 rounded-xl border bg-card p-2 pb-3 transition-shadow ${isDragging ? "shadow-lg ring-2 ring-ring/40" : ""}`}
    >
      <div className="flex items-center gap-1">
        <DragHandle handle={handle} label={name} />
        <span aria-hidden className="num w-6 shrink-0 text-sm text-muted-foreground">
          {String(index + 1).padStart(2, "0")}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-semibold" data-testid="routine-item-name">
            {name}
          </h3>
          {item.exercise.muscle_group && (
            <p className="truncate text-xs text-muted-foreground">{item.exercise.muscle_group}</p>
          )}
        </div>
        <MoveButtons label={name} index={index} count={count} onMove={onMove} />
      </div>

      <div className="grid grid-cols-2 gap-3 px-2">
        <Stepper
          label="Séries"
          value={item.sets}
          min={SETS_MIN}
          max={SETS_MAX}
          onChange={(sets) => save({ sets })}
        />
        <Stepper
          label="Descanso"
          value={item.rest_sec ?? routine.rest_sec}
          hint={item.rest_sec === null ? "padrão" : undefined}
          min={REST_MIN}
          max={REST_MAX}
          step={REST_STEP}
          format={formatRest}
          onChange={(rest_sec) => save({ rest_sec })}
        />
      </div>

      <BlurSaveField
        className="px-2"
        label="Observação técnica"
        labelClassName="text-xs font-normal text-muted-foreground"
        value={item.notes ?? ""}
        multiline
        maxLength={2000}
        placeholder="Ex.: pegada neutra, 2 s na descida"
        onSave={(notes) => save({ notes })}
      />

      <div className="flex flex-wrap justify-end gap-1 px-1">
        {item.rest_sec !== null && (
          <Button variant="ghost" className="h-11 text-sm" onClick={() => save({ rest_sec: null })}>
            <RotateCcw aria-hidden />
            Usar descanso padrão
          </Button>
        )}
        <Button
          variant="ghost"
          className="h-11 text-sm text-destructive hover:text-destructive"
          aria-label={`Remover ${name} da rotina`}
          onClick={() => {
            remove.mutate({ id: item.id, before: routine.routine_exercises });
            toast(`${name} removido da rotina.`);
          }}
        >
          <Trash2 aria-hidden />
          Remover
        </Button>
      </div>
    </article>
  );
}

/** "Salvando…" enquanto houver gravação na fila; "Salvo" depois da primeira. */
function SaveStatus() {
  const pending = useIsMutating({ mutationKey: ROUTINE_MUTATION_KEY });
  const [touched, setTouched] = useState(false);
  if (pending > 0 && !touched) setTouched(true);
  if (!touched) return null;
  return (
    <p role="status" className="flex items-center gap-1.5 text-xs text-muted-foreground" data-testid="save-status">
      {pending > 0 ? (
        <>
          <LoaderCircle aria-hidden className="size-3.5 animate-spin" />
          Salvando…
        </>
      ) : (
        <>
          <Check aria-hidden className="size-3.5 text-primary-text" />
          Salvo
        </>
      )}
    </p>
  );
}

export function EditorSkeleton() {
  return (
    <div aria-busy="true" aria-label="Carregando rotina" className="space-y-4">
      <Skeleton className="h-6 w-24" />
      <Skeleton className="h-9 w-56" />
      <Skeleton className="h-48 w-full rounded-xl" />
      <Skeleton className="h-40 w-full rounded-xl" />
    </div>
  );
}
