"use client";

import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { DataError } from "@/features/routines/api";
import { weekKeys } from "@/features/week/api";
import { STREAK_MAX_WEEKS } from "@/lib/domain/habits";
import { addWeeks, weekDays } from "@/lib/domain/week";
import {
  deleteHabit,
  deleteHabitLogs,
  fetchHabitLogs,
  fetchHabits,
  fetchTrainedDays,
  habitKeys,
  updateHabit,
  upsertHabit,
  upsertHabitLog,
  type Habit,
  type HabitInsert,
  type HabitLog,
  type HabitLogInsert,
  type HabitPatch,
} from "./api";

/** Período lido de uma vez: a semana atual (progresso) e as anteriores (streak). */
export function logRange(week: string) {
  return { from: addWeeks(week, -STREAK_MAX_WEEKS), to: weekDays(week)[6] };
}

function errorMessage(error: unknown) {
  return error instanceof DataError ? error.message : "Algo deu errado. Tente de novo.";
}

// ── Leituras ──────────────────────────────────────────────────────────────

export function useHabits() {
  return useQuery({ queryKey: habitKeys.list(), queryFn: () => fetchHabits() });
}

/** Registros da semana `week` e das anteriores (até `STREAK_MAX_WEEKS`), de todos os hábitos. */
export function useHabitLogs(week: string) {
  const { from, to } = logRange(week);
  return useQuery({ queryKey: habitKeys.logs(from, to), queryFn: () => fetchHabitLogs(from, to) });
}

/** Dias com treino finalizado no mesmo período (streak do "Treino"). */
export function useTrainedDays(week: string) {
  const { from, to } = logRange(week);
  return useQuery({ queryKey: habitKeys.trainedDays(from, to), queryFn: () => fetchTrainedDays(from, to) });
}

// ── Registros ─────────────────────────────────────────────────────────────

const HABIT_LOG_MUTATION_KEY = ["habit-logs"] as const;

/**
 * Registrar/desfazer: otimista no cache da semana, em fila única (toques rápidos chegam
 * em ordem) e, quando a última gravação termina, revalida os registros e o resumo da semana.
 */
function useHabitLogMutation<V extends { week: string }>(
  mutationFn: (v: V) => Promise<void>,
  apply: (logs: HabitLog[], v: V) => HabitLog[],
) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: HABIT_LOG_MUTATION_KEY,
    scope: { id: "habit-logs" },
    mutationFn,
    onMutate: async (vars: V) => {
      const { from, to } = logRange(vars.week);
      const key = habitKeys.logs(from, to);
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<HabitLog[]>(key);
      qc.setQueryData<HabitLog[]>(key, (old) => apply(old ?? [], vars));
      return { previous, key };
    },
    onError: (error, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(ctx.key, ctx.previous);
      toast.error(errorMessage(error));
    },
    onSettled: () => {
      if (qc.isMutating({ mutationKey: HABIT_LOG_MUTATION_KEY }) === 1) {
        return Promise.all([
          qc.invalidateQueries({ queryKey: [...habitKeys.all, "logs"] }),
          qc.invalidateQueries({ queryKey: weekKeys.all }),
        ]);
      }
    },
  });
}

/** Grava um registro (id gerado no cliente). `week` = semana em tela, para o otimismo. */
export function useLogHabit() {
  return useHabitLogMutation(
    ({ log }: { week: string; log: HabitLogInsert }) => upsertHabitLog(log),
    (logs, { log }) => [
      ...logs.filter((l) => l.id !== log.id),
      { ...log, created_at: new Date().toISOString() },
    ],
  );
}

/** Desfaz registros (por id). */
export function useUndoHabitLog() {
  return useHabitLogMutation(
    ({ ids }: { week: string; ids: string[] }) => deleteHabitLogs(ids),
    (logs, { ids }) => logs.filter((l) => !ids.includes(l.id)),
  );
}

export function newHabitLog(habitId: string, day: string, fields: Partial<HabitLogInsert> = {}): HabitLogInsert {
  return {
    id: crypto.randomUUID(),
    habit_id: habitId,
    day,
    value: 1,
    cardio_type: null,
    distance_km: null,
    kcal: null,
    ...fields,
  };
}

// ── Hábitos ───────────────────────────────────────────────────────────────

const HABIT_MUTATION_KEY = ["habits-edit"] as const;

type HabitsSnapshot = { habits?: Habit[] };

async function snapshotHabits(qc: QueryClient): Promise<HabitsSnapshot> {
  await qc.cancelQueries({ queryKey: habitKeys.list() });
  return { habits: qc.getQueryData<Habit[]>(habitKeys.list()) };
}

function setHabits(qc: QueryClient, fn: (habits: Habit[]) => Habit[]) {
  qc.setQueryData<Habit[]>(habitKeys.list(), (old) => (old ? fn(old) : old));
}

/** Mesmo padrão das rotinas: otimismo, desfaz no erro, revalida ao fim da fila. */
function habitMutationOptions(qc: QueryClient) {
  return {
    mutationKey: HABIT_MUTATION_KEY,
    scope: { id: "habits" },
    onError: (error: unknown, _vars: unknown, snap: HabitsSnapshot | undefined) => {
      if (snap?.habits) qc.setQueryData(habitKeys.list(), snap.habits);
      toast.error(errorMessage(error));
    },
    onSettled: () => {
      if (qc.isMutating({ mutationKey: HABIT_MUTATION_KEY }) === 1) {
        return Promise.all([
          qc.invalidateQueries({ queryKey: habitKeys.all }),
          qc.invalidateQueries({ queryKey: weekKeys.all }),
        ]);
      }
    },
  };
}

export function useCreateHabit() {
  const qc = useQueryClient();
  return useMutation({
    ...habitMutationOptions(qc),
    mutationFn: (row: HabitInsert) => upsertHabit(row),
    onMutate: async (row) => {
      const snap = await snapshotHabits(qc);
      const optimistic: Habit = {
        ...row,
        user_id: "",
        system_key: null,
        archived_at: null,
        created_at: new Date().toISOString(),
      };
      setHabits(qc, (habits) => [...habits, optimistic]);
      return snap;
    },
  });
}

export function useUpdateHabit() {
  const qc = useQueryClient();
  return useMutation({
    ...habitMutationOptions(qc),
    mutationFn: ({ id, patch }: { id: string; patch: HabitPatch }) => updateHabit(id, patch),
    onMutate: async ({ id, patch }) => {
      const snap = await snapshotHabits(qc);
      setHabits(qc, (habits) => habits.map((h) => (h.id === id ? { ...h, ...patch } : h)));
      return snap;
    },
  });
}

export function useDeleteHabit() {
  const qc = useQueryClient();
  return useMutation({
    ...habitMutationOptions(qc),
    mutationFn: (id: string) => deleteHabit(id),
    onMutate: async (id) => {
      const snap = await snapshotHabits(qc);
      setHabits(qc, (habits) => habits.filter((h) => h.id !== id));
      return snap;
    },
  });
}
