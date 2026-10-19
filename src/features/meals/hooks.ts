"use client";

import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { toast } from "sonner";
import { DataError } from "@/features/routines/api";
import { useWorkoutHydrated } from "@/features/workout-session/hooks";
import { useActiveWorkout } from "@/features/workout-session/store";
import { weekKeys } from "@/features/week/api";
import { adherence, hasWorkoutOn, visibleMeals } from "@/lib/domain/meals";
import {
  deleteMeal,
  deleteMealLog,
  deleteMealOption,
  fetchHasFinishedWorkout,
  fetchMealLogs,
  fetchMealPlan,
  mealKeys,
  saveMealPositions,
  updateMeal,
  updateMealOption,
  upsertMeal,
  upsertMealLog,
  upsertMealOption,
  workoutDayKey,
  type Meal,
  type MealInsert,
  type MealLog,
  type MealOption,
  type MealOptionInsert,
  type MealOptionPatch,
  type MealPatch,
} from "./api";

// ── Leituras ──────────────────────────────────────────────────────────────

export function useMealPlan() {
  return useQuery({ queryKey: mealKeys.plan(), queryFn: () => fetchMealPlan() });
}

export function useMealLogs(day: string | null) {
  return useQuery({
    queryKey: mealKeys.logs(day ?? ""),
    queryFn: () => fetchMealLogs(day!),
    enabled: !!day,
  });
}

/**
 * Há treino no dia? Sessão iniciada no aparelho nesse dia (inclusive finalizada e ainda
 * pendente de envio) ou treino finalizado no banco. `ready` = já dá para decidir.
 */
export function useHasWorkout(day: string | null) {
  const hydrated = useWorkoutHydrated();
  const activeStartedAt = useActiveWorkout((s) => s.workout?.startedAt ?? null);
  const finished = useQuery({
    queryKey: workoutDayKey(day ?? ""),
    queryFn: () => fetchHasFinishedWorkout(day!),
    enabled: !!day,
  });
  const ready = hydrated && finished.data !== undefined;
  const hasWorkout =
    !!day && hasWorkoutOn(day, { activeStartedAt: hydrated ? activeStartedAt : null, finishedDays: finished.data ? [day] : [] });
  return { hasWorkout, ready, isError: finished.isError, refetch: finished.refetch };
}

/** Tudo o que a tela do dia precisa: refeições visíveis, registro de cada uma e a adesão. */
export function useMealDay(day: string | null) {
  const plan = useMealPlan();
  const logs = useMealLogs(day);
  const workout = useHasWorkout(day);

  const derived = useMemo(() => {
    if (!plan.data || !logs.data) return null;
    const visible = visibleMeals(plan.data, workout.hasWorkout);
    const byMeal = new Map(logs.data.map((l) => [l.meal_id, l]));
    return {
      visible,
      byMeal,
      adherence: adherence(logs.data, visible),
      hiddenTrainingMeals: plan.data.filter((m) => m.training_day_only && !workout.hasWorkout),
    };
  }, [plan.data, logs.data, workout.hasWorkout]);

  return {
    data: workout.ready ? derived : null,
    isError: plan.isError || logs.isError || workout.isError,
    refetch: () => Promise.all([plan.refetch(), logs.refetch(), workout.refetch()]),
  };
}

function errorMessage(error: unknown) {
  return error instanceof DataError ? error.message : "Algo deu errado. Tente de novo.";
}

// ── Registro do dia ───────────────────────────────────────────────────────

const MEAL_LOG_MUTATION_KEY = ["meal-logs"] as const;

/**
 * Marcar/desmarcar: otimista no cache do dia, em fila única (toques rápidos chegam em
 * ordem) e, quando a última gravação termina, revalida o dia e o resumo da semana.
 */
function useMealLogMutation<V extends { day: string }>(
  mutationFn: (v: V) => Promise<void>,
  apply: (logs: MealLog[], v: V) => MealLog[],
) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: MEAL_LOG_MUTATION_KEY,
    scope: { id: "meal-logs" },
    mutationFn,
    onMutate: async (vars: V) => {
      const key = mealKeys.logs(vars.day);
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<MealLog[]>(key);
      qc.setQueryData<MealLog[]>(key, (old) => apply(old ?? [], vars));
      return { previous };
    },
    onError: (error, vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(mealKeys.logs(vars.day), ctx.previous);
      toast.error(errorMessage(error));
    },
    onSettled: (_data, _error, vars) => {
      if (qc.isMutating({ mutationKey: MEAL_LOG_MUTATION_KEY }) === 1) {
        return Promise.all([
          qc.invalidateQueries({ queryKey: mealKeys.logs(vars.day) }),
          qc.invalidateQueries({ queryKey: weekKeys.all }),
        ]);
      }
    },
  });
}

/** Marca a refeição (opção escolhida ou fora do plano); trocar de opção substitui o registro. */
export function useLogMeal() {
  return useMealLogMutation(
    (log: MealLog) => upsertMealLog(log),
    (logs, log) => [...logs.filter((l) => l.meal_id !== log.meal_id), log],
  );
}

export function useUnlogMeal() {
  return useMealLogMutation(
    (v: { day: string; meal_id: string }) => deleteMealLog(v),
    (logs, v) => logs.filter((l) => l.meal_id !== v.meal_id),
  );
}

/** Registro novo ou o mesmo id do existente (a chave natural é o dia + refeição). */
export function buildMealLog(
  existing: MealLog | undefined,
  base: { day: string; meal_id: string },
  choice: { option_id: string } | { off_plan: true; note: string | null },
): MealLog {
  const id = existing?.id ?? crypto.randomUUID();
  return "option_id" in choice
    ? { id, ...base, option_id: choice.option_id, off_plan: false, note: null }
    : { id, ...base, option_id: null, off_plan: true, note: choice.note };
}

// ── Plano ─────────────────────────────────────────────────────────────────

export const MEAL_PLAN_MUTATION_KEY = ["meal-plan"] as const;

type PlanSnapshot = { plan?: Meal[] };

async function snapshotPlan(qc: QueryClient): Promise<PlanSnapshot> {
  await qc.cancelQueries({ queryKey: mealKeys.plan() });
  return { plan: qc.getQueryData<Meal[]>(mealKeys.plan()) };
}

function setPlan(qc: QueryClient, fn: (plan: Meal[]) => Meal[]) {
  qc.setQueryData<Meal[]>(mealKeys.plan(), (old) => (old ? fn(old) : old));
}

function setOptions(qc: QueryClient, mealId: string, fn: (options: MealOption[]) => MealOption[]) {
  setPlan(qc, (plan) => plan.map((m) => (m.id === mealId ? { ...m, meal_options: fn(m.meal_options) } : m)));
}

/**
 * Mesmo padrão das rotinas: otimismo no `onMutate`, desfaz no erro e revalida quando a
 * última gravação da fila termina. O plano muda o que é previsto no dia e na semana.
 */
function planMutationOptions(qc: QueryClient) {
  return {
    mutationKey: MEAL_PLAN_MUTATION_KEY,
    scope: { id: "meal-plan" },
    onError: (error: unknown, _vars: unknown, snap: PlanSnapshot | undefined) => {
      if (snap?.plan) qc.setQueryData(mealKeys.plan(), snap.plan);
      toast.error(errorMessage(error));
    },
    onSettled: () => {
      if (qc.isMutating({ mutationKey: MEAL_PLAN_MUTATION_KEY }) === 1) {
        return Promise.all([
          qc.invalidateQueries({ queryKey: mealKeys.all }),
          qc.invalidateQueries({ queryKey: weekKeys.all }),
        ]);
      }
    },
  };
}

export function useCreateMeal() {
  const qc = useQueryClient();
  return useMutation({
    ...planMutationOptions(qc),
    mutationFn: (row: MealInsert) => upsertMeal(row),
    onMutate: async (row) => {
      const snap = await snapshotPlan(qc);
      const optimistic: Meal = { ...row, user_id: "", created_at: new Date().toISOString(), meal_options: [] };
      setPlan(qc, (plan) => [...plan, optimistic]);
      return snap;
    },
  });
}

export function useUpdateMeal() {
  const qc = useQueryClient();
  return useMutation({
    ...planMutationOptions(qc),
    mutationFn: ({ id, patch }: { id: string; patch: MealPatch }) => updateMeal(id, patch),
    onMutate: async ({ id, patch }) => {
      const snap = await snapshotPlan(qc);
      setPlan(qc, (plan) => plan.map((m) => (m.id === id ? { ...m, ...patch } : m)));
      return snap;
    },
  });
}

export function useReorderMeals() {
  const qc = useQueryClient();
  return useMutation({
    ...planMutationOptions(qc),
    mutationFn: (changed: Pick<Meal, "id" | "position">[]) => saveMealPositions(changed),
    onMutate: async (changed) => {
      const snap = await snapshotPlan(qc);
      const positions = new Map(changed.map((m) => [m.id, m.position]));
      setPlan(qc, (plan) =>
        plan
          .map((m) => (positions.has(m.id) ? { ...m, position: positions.get(m.id)! } : m))
          .sort((a, b) => a.position - b.position),
      );
      return snap;
    },
  });
}

export function useDeleteMeal() {
  const qc = useQueryClient();
  return useMutation({
    ...planMutationOptions(qc),
    mutationFn: (id: string) => deleteMeal(id),
    onMutate: async (id) => {
      const snap = await snapshotPlan(qc);
      setPlan(qc, (plan) => plan.filter((m) => m.id !== id));
      return snap;
    },
  });
}

export function useCreateMealOption() {
  const qc = useQueryClient();
  return useMutation({
    ...planMutationOptions(qc),
    mutationFn: (row: MealOptionInsert) => upsertMealOption(row),
    onMutate: async (row) => {
      const snap = await snapshotPlan(qc);
      setOptions(qc, row.meal_id, (options) => [
        ...options,
        { ...row, user_id: "", created_at: new Date().toISOString() },
      ]);
      return snap;
    },
  });
}

export function useUpdateMealOption() {
  const qc = useQueryClient();
  return useMutation({
    ...planMutationOptions(qc),
    mutationFn: ({ id, patch }: { id: string; mealId: string; patch: MealOptionPatch }) => updateMealOption(id, patch),
    onMutate: async ({ id, mealId, patch }) => {
      const snap = await snapshotPlan(qc);
      setOptions(qc, mealId, (options) => options.map((o) => (o.id === id ? { ...o, ...patch } : o)));
      return snap;
    },
  });
}

export function useDeleteMealOption() {
  const qc = useQueryClient();
  return useMutation({
    ...planMutationOptions(qc),
    mutationFn: ({ id }: { id: string; mealId: string }) => deleteMealOption(id),
    onMutate: async ({ id, mealId }) => {
      const snap = await snapshotPlan(qc);
      setOptions(qc, mealId, (options) => options.filter((o) => o.id !== id));
      return snap;
    },
  });
}
