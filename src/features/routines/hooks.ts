"use client";

import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { findDuplicateExercise, nextPosition, removeById } from "@/features/routines/domain/routines";
import { REST_DEFAULT } from "@/features/routines/schemas/routine";
import { WRITES, type RoutineItemPatch, type RoutinePatch } from "@/lib/query/mutation-defaults";
import { progressKeys } from "@/features/progress/api";
import {
  DataError,
  duplicateExerciseMessage,
  exerciseKeys,
  fetchExercises,
  fetchRoutine,
  fetchRoutineWorkoutCount,
  fetchRoutines,
  NEW_EXERCISE_DEFAULTS,
  routineKeys,
  type Exercise,
  type ExerciseSummary,
  type RoutineDetail,
  type RoutineItem,
  type RoutineListItem,
} from "./api";

// ── Leituras ──────────────────────────────────────────────────────────────

export function useRoutines() {
  return useQuery({ queryKey: routineKeys.list(), queryFn: fetchRoutines });
}

export function useRoutine(id: string, enabled = true) {
  return useQuery({ queryKey: routineKeys.detail(id), queryFn: () => fetchRoutine(id), enabled });
}

export function useExercises() {
  return useQuery({ queryKey: exerciseKeys.all, queryFn: fetchExercises });
}

export function useRoutineWorkoutCount(id: string, enabled: boolean) {
  return useQuery({
    queryKey: routineKeys.workoutCount(id),
    queryFn: () => fetchRoutineWorkoutCount(id),
    enabled,
  });
}

// ── Infra das mutações ────────────────────────────────────────────────────

/** Todas as mutações de rotina usam esta chave (para o indicador "Salvando…"). */
export const ROUTINE_MUTATION_KEY = ["routines"] as const;
// Cada gravação tem chave própria (`WRITES`, fila offline), prefixada pela do grupo.

type Snapshot = { list?: RoutineListItem[]; detail?: RoutineDetail | null; detailId?: string };

/** Para refetches em andamento e guarda o estado atual, para desfazer em caso de erro. */
async function snapshot(qc: QueryClient, detailId?: string): Promise<Snapshot> {
  await qc.cancelQueries({ queryKey: routineKeys.all });
  return {
    list: qc.getQueryData<RoutineListItem[]>(routineKeys.list()),
    detail: detailId ? qc.getQueryData<RoutineDetail | null>(routineKeys.detail(detailId)) : undefined,
    detailId,
  };
}

function restore(qc: QueryClient, snap: Snapshot | undefined) {
  if (!snap) return;
  if (snap.list) qc.setQueryData(routineKeys.list(), snap.list);
  if (snap.detailId && snap.detail !== undefined) qc.setQueryData(routineKeys.detail(snap.detailId), snap.detail);
}

function setList(qc: QueryClient, fn: (list: RoutineListItem[]) => RoutineListItem[]) {
  qc.setQueryData<RoutineListItem[]>(routineKeys.list(), (old) => (old ? fn(old) : old));
}

function setDetail(qc: QueryClient, id: string, fn: (r: RoutineDetail) => RoutineDetail) {
  qc.setQueryData<RoutineDetail | null>(routineKeys.detail(id), (old) => (old ? fn(old) : old));
}

/** O card da lista mostra nº de exercícios e séries: espelha os itens do editor. */
function syncListItems(qc: QueryClient, routineId: string, items: RoutineItem[]) {
  setList(qc, (list) =>
    list.map((r) =>
      r.id === routineId ? { ...r, routine_exercises: items.map(({ id, sets }) => ({ id, sets })) } : r,
    ),
  );
}

function errorMessage(error: unknown) {
  return error instanceof DataError ? error.message : "Algo deu errado. Tente de novo.";
}

/**
 * Opções comuns: otimismo já aplicado no `onMutate` de cada hook, desfaz no erro e,
 * quando a última mutação da fila termina, revalida com o banco.
 * Um único `scope` serializa todas as gravações de rotina: cliques rápidos no stepper chegam
 * em ordem e um item nunca é gravado antes da rotina recém-criada.
 */
function routineMutationOptions(qc: QueryClient) {
  return {
    scope: { id: "routines" },
    onError: (error: unknown, _vars: unknown, snap: Snapshot | undefined) => {
      restore(qc, snap);
      toast.error(errorMessage(error));
    },
    onSettled: () => {
      if (qc.isMutating({ mutationKey: ROUTINE_MUTATION_KEY }) === 1) {
        return qc.invalidateQueries({ queryKey: routineKeys.all });
      }
    },
  };
}

// ── Rotinas ───────────────────────────────────────────────────────────────

export function useCreateRoutine() {
  const qc = useQueryClient();
  return useMutation({
    ...routineMutationOptions(qc),
    ...WRITES.createRoutine,
    onMutate: async (row) => {
      const snap = await snapshot(qc);
      const optimistic: RoutineListItem = {
        ...row,
        user_id: "",
        notes: null,
        rest_sec: REST_DEFAULT,
        archived_at: null,
        created_at: new Date().toISOString(),
        routine_exercises: [],
      };
      setList(qc, (list) => [...list, optimistic]);
      qc.setQueryData<RoutineDetail>(routineKeys.detail(row.id), { ...optimistic, routine_exercises: [] });
      return snap;
    },
  });
}

export function useUpdateRoutine() {
  const qc = useQueryClient();
  return useMutation({
    ...routineMutationOptions(qc),
    ...WRITES.updateRoutine,
    onMutate: async ({ id, patch }: { id: string; patch: RoutinePatch }) => {
      const snap = await snapshot(qc, id);
      setDetail(qc, id, (r) => ({ ...r, ...patch }));
      setList(qc, (list) => list.map((r) => (r.id === id ? { ...r, ...patch } : r)));
      return snap;
    },
  });
}

/** Reordena as rotinas ativas (arrastar ou subir/descer). */
export function useReorderRoutines() {
  const qc = useQueryClient();
  return useMutation({
    ...routineMutationOptions(qc),
    ...WRITES.reorderRoutines,
    onMutate: async ({ after }) => {
      const snap = await snapshot(qc);
      const positions = new Map(after.map((r) => [r.id, r.position]));
      setList(qc, (list) =>
        list
          .map((r) => (positions.has(r.id) ? { ...r, position: positions.get(r.id)! } : r))
          .sort((a, b) => a.position - b.position),
      );
      return snap;
    },
  });
}

export function useSetRoutineArchived() {
  const qc = useQueryClient();
  return useMutation({
    ...routineMutationOptions(qc),
    ...WRITES.setRoutineArchived,
    onMutate: async ({ id, archived, position }) => {
      const snap = await snapshot(qc, id);
      const archived_at = archived ? new Date().toISOString() : null;
      const patch = { archived_at, ...(position !== undefined && { position }) };
      setList(qc, (list) => list.map((r) => (r.id === id ? { ...r, ...patch } : r)));
      setDetail(qc, id, (r) => ({ ...r, ...patch }));
      return snap;
    },
  });
}

export function useDeleteRoutine() {
  const qc = useQueryClient();
  return useMutation({
    ...routineMutationOptions(qc),
    ...WRITES.deleteRoutine,
    onMutate: async (id) => {
      const snap = await snapshot(qc);
      setList(qc, (list) => list.filter((r) => r.id !== id));
      return snap;
    },
    onSuccess: (_data, id) => qc.removeQueries({ queryKey: routineKeys.detail(id) }),
  });
}

// ── Exercícios da rotina ──────────────────────────────────────────────────

export function useAddRoutineExercise(routineId: string) {
  const qc = useQueryClient();
  return useMutation({
    ...routineMutationOptions(qc),
    ...WRITES.addRoutineExercise,
    onMutate: async (item) => {
      const snap = await snapshot(qc, routineId);
      setDetail(qc, routineId, (r) => {
        const items = [...r.routine_exercises, item];
        syncListItems(qc, routineId, items);
        return { ...r, routine_exercises: items };
      });
      return snap;
    },
  });
}

/** Monta o item novo no fim da rotina, com 3 séries e o descanso padrão da rotina. */
export function newRoutineItem(routine: RoutineDetail, exercise: ExerciseSummary): RoutineItem {
  return {
    id: crypto.randomUUID(),
    user_id: routine.user_id,
    routine_id: routine.id,
    exercise_id: exercise.id,
    position: nextPosition(routine.routine_exercises),
    sets: 3,
    rest_sec: null,
    notes: null,
    created_at: new Date().toISOString(),
    exercise: { id: exercise.id, name: exercise.name, muscle_group: exercise.muscle_group },
  };
}

export function useUpdateRoutineExercise(routineId: string) {
  const qc = useQueryClient();
  return useMutation({
    ...routineMutationOptions(qc),
    ...WRITES.updateRoutineExercise,
    onMutate: async ({ id, patch }: { id: string; patch: RoutineItemPatch }) => {
      const snap = await snapshot(qc, routineId);
      setDetail(qc, routineId, (r) => {
        const items = r.routine_exercises.map((i) => (i.id === id ? { ...i, ...patch } : i));
        syncListItems(qc, routineId, items);
        return { ...r, routine_exercises: items };
      });
      return snap;
    },
  });
}

export function useReorderRoutineExercises(routineId: string) {
  const qc = useQueryClient();
  return useMutation({
    ...routineMutationOptions(qc),
    ...WRITES.reorderRoutineExercises,
    onMutate: async ({ after }) => {
      const snap = await snapshot(qc, routineId);
      setDetail(qc, routineId, (r) => ({ ...r, routine_exercises: after }));
      return snap;
    },
  });
}

export function useRemoveRoutineExercise(routineId: string) {
  const qc = useQueryClient();
  return useMutation({
    ...routineMutationOptions(qc),
    ...WRITES.removeRoutineExercise,
    onMutate: async ({ id, before }) => {
      const snap = await snapshot(qc, routineId);
      const after = removeById(before, id);
      setDetail(qc, routineId, (r) => ({ ...r, routine_exercises: after }));
      syncListItems(qc, routineId, after);
      return snap;
    },
  });
}

/** Desfazer a remoção: devolve o item (mesmo id) e a ordem de antes. */
export function useRestoreRoutineExercise(routineId: string) {
  const qc = useQueryClient();
  return useMutation({
    ...routineMutationOptions(qc),
    ...WRITES.restoreRoutineExercise,
    onMutate: async ({ before }) => {
      const snap = await snapshot(qc, routineId);
      setDetail(qc, routineId, (r) => ({ ...r, routine_exercises: before }));
      syncListItems(qc, routineId, before);
      return snap;
    },
  });
}

// ── Biblioteca de exercícios ──────────────────────────────────────────────

function exerciseMutationOptions(qc: QueryClient) {
  return {
    scope: { id: "exercises" },
    onError: (_error: unknown, _vars: unknown, snap: { previous?: Exercise[] } | undefined) => {
      if (snap?.previous) qc.setQueryData(exerciseKeys.all, snap.previous);
    },
    onSettled: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: exerciseKeys.all }),
        // O nome aparece também nos itens das rotinas.
        qc.invalidateQueries({ queryKey: routineKeys.all }),
        qc.invalidateQueries({ queryKey: progressKeys.all }),
      ]),
  };
}

/** Recusa nome repetido antes de ir ao banco (o `unique` do banco é a garantia final). */
function assertUniqueName(qc: QueryClient, name: string, exceptId?: string) {
  const current = qc.getQueryData<Exercise[]>(exerciseKeys.all) ?? [];
  if (findDuplicateExercise(name, current, exceptId)) {
    throw new DataError(duplicateExerciseMessage(name), "duplicate");
  }
}

export function useCreateExercise() {
  const qc = useQueryClient();
  return useMutation({
    ...exerciseMutationOptions(qc),
    ...WRITES.createExercise,
    onMutate: async (row) => {
      assertUniqueName(qc, row.name);
      await qc.cancelQueries({ queryKey: exerciseKeys.all });
      const previous = qc.getQueryData<Exercise[]>(exerciseKeys.all);
      const optimistic: Exercise = {
        ...NEW_EXERCISE_DEFAULTS,
        ...row,
        user_id: "",
        created_at: new Date().toISOString(),
      };
      qc.setQueryData<Exercise[]>(exerciseKeys.all, (old) => (old ? [...old, optimistic] : old));
      return { previous };
    },
  });
}

export function useUpdateExercise() {
  const qc = useQueryClient();
  return useMutation({
    ...exerciseMutationOptions(qc),
    ...WRITES.updateExercise,
    onMutate: async ({ id, name, muscle_group }) => {
      assertUniqueName(qc, name, id);
      await qc.cancelQueries({ queryKey: exerciseKeys.all });
      const previous = qc.getQueryData<Exercise[]>(exerciseKeys.all);
      qc.setQueryData<Exercise[]>(exerciseKeys.all, (old) =>
        old?.map((e) => (e.id === id ? { ...e, name, muscle_group } : e)),
      );
      return { previous };
    },
  });
}

export { errorMessage as mutationErrorMessage };
