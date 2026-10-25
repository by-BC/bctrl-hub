import type { MutationKey, QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { changedPositions, removeById } from "@/features/routines/domain/routines";
import { REST_DEFAULT } from "@/features/routines/schemas/routine";
import {
  deleteRoutine,
  deleteRoutineExercise,
  saveRoutineExercisePositions,
  saveRoutinePositions,
  stripExercise,
  updateExercise,
  updateRoutine,
  updateRoutineExercise,
  upsertExercise,
  upsertRoutine,
  upsertRoutineExercise,
  type Exercise,
  type RoutineDetail,
  type RoutineExercise,
  type RoutineItem,
  type RoutineListItem,
} from "@/features/routines/api";
import { deleteWorkout, updateWorkoutSet } from "@/features/history/api";
import { deleteBodyWeight, upsertBodyWeight, type BodyWeight } from "@/features/progress/api";
import {
  deleteMeal,
  deleteMealLog,
  deleteOffPlanItem,
  deleteMealOption,
  saveMealPositions,
  updateMeal,
  updateMealOption,
  upsertMeal,
  upsertMealLog,
  upsertMealOption,
  upsertOffPlanItem,
  type Meal,
  type MealInsert,
  type MealLog,
  type MealOptionInsert,
  type MealOptionPatch,
  type MealPatch,
  type OffPlanItemInsert,
} from "@/features/meals/api";
import { upsertOwnFood, type OwnFoodInsert } from "@/features/nutrition/api";
import { upsertProfile, type ProfileSave } from "@/features/profile/api";
import {
  deleteMeasurement,
  updateCompositionGoal,
  upsertCompositionGoal,
  upsertMeasurement,
  type CompositionGoalPatch,
  type CompositionGoalSave,
  type MeasurementSave,
} from "@/features/composition/api";
import {
  deleteHabit,
  deleteHabitLogs,
  updateHabit,
  upsertHabit,
  upsertHabitLog,
  type HabitInsert,
  type HabitLogInsert,
  type HabitPatch,
} from "@/features/habits/api";
import { deleteTask, setTaskDone, upsertTask, type Task } from "@/features/tasks/api";
import {
  createFinanceCategory,
  deleteFinanceTransaction,
  saveFinanceAccount,
  saveFinanceBudget,
  saveFinanceRecurringRule,
  saveFinanceTransactions,
  setFinanceInvoicePaid,
  setFinanceRecurringActive,
  setFinanceTransactionPaid,
  type FinanceTransactionSave,
} from "@/features/finance/api";
import type { FinanceAccountSave, FinanceBudgetSave, FinanceRecurringSave } from "@/features/finance/schemas/finance";

/**
 * Fila offline: toda gravação tem uma chave própria e a função de envio registrada aqui.
 *
 * Mutação feita sem rede fica pausada e é salva no `localStorage` (só chave, variáveis e
 * estado: funções não são serializáveis). Ao reabrir o app, o `QueryClient` reidrata a
 * mutação e encontra a função pela chave com `setMutationDefaults`, para reenviar.
 * Por isso as variáveis precisam carregar tudo o que o envio usa (nada de closure do hook).
 *
 * As chaves são prefixadas pela chave do grupo (ex.: `["routines", …]`), então
 * `useIsMutating({ mutationKey: ["routines"] })` continua contando o grupo inteiro.
 */
function write<V, R = void>(mutationKey: readonly [string, string], mutationFn: (v: V) => Promise<R>) {
  return { mutationKey, mutationFn };
}

/** Linha do item sem os campos de junção; mantém `user_id` só quando já veio do banco. */
function stripRow(item: RoutineItem): RoutineExercise {
  const { user_id, ...row } = stripExercise(item);
  // Item criado otimisticamente antes de a rotina chegar do banco: deixa o default (auth.uid()).
  return (user_id ? { ...row, user_id } : row) as RoutineExercise;
}

export type RoutinePatch = Partial<Pick<RoutineDetail, "name" | "notes" | "rest_sec">>;
export type RoutineItemPatch = Partial<Pick<RoutineExercise, "sets" | "rest_sec" | "notes">>;
/** Campos editáveis de uma série gravada (os do tipo do exercício). */
export type SetPatch = Partial<{ weight_kg: number | null; reps: number | null; distance_m: number | null; duration_s: number | null }>;

export const WRITES = {
  // Rotinas e exercícios da rotina (scope "routines")
  createRoutine: write(["routines", "create"], (row: { id: string; name: string; position: number }) =>
    upsertRoutine({ ...row, rest_sec: REST_DEFAULT }),
  ),
  updateRoutine: write(["routines", "update"], ({ id, patch }: { id: string; patch: RoutinePatch }) =>
    updateRoutine(id, patch),
  ),
  reorderRoutines: write(
    ["routines", "reorder"],
    ({ before, after }: { before: RoutineListItem[]; after: RoutineListItem[] }) =>
      saveRoutinePositions(changedPositions(before, after)),
  ),
  setRoutineArchived: write(
    ["routines", "archive"],
    ({ id, archived, position }: { id: string; archived: boolean; position?: number }) =>
      updateRoutine(id, {
        archived_at: archived ? new Date().toISOString() : null,
        ...(position !== undefined && { position }),
      }),
  ),
  deleteRoutine: write(["routines", "delete"], (id: string) => deleteRoutine(id)),
  addRoutineExercise: write(["routines", "add-exercise"], (item: RoutineItem) =>
    upsertRoutineExercise(stripRow(item)),
  ),
  updateRoutineExercise: write(
    ["routines", "update-exercise"],
    ({ id, patch }: { id: string; patch: RoutineItemPatch }) => updateRoutineExercise(id, patch),
  ),
  reorderRoutineExercises: write(
    ["routines", "reorder-exercises"],
    ({ before, after }: { before: RoutineItem[]; after: RoutineItem[] }) =>
      saveRoutineExercisePositions(changedPositions(before, after).map(stripRow)),
  ),
  removeRoutineExercise: write(
    ["routines", "remove-exercise"],
    async ({ id, before }: { id: string; before: RoutineItem[] }) => {
      await deleteRoutineExercise(id);
      // Fecha o buraco deixado na ordem.
      const after = removeById(before, id);
      await saveRoutineExercisePositions(changedPositions(before, after).map(stripRow));
    },
  ),
  /** Desfazer a remoção: recria o item com o mesmo id e devolve a ordem anterior. */
  restoreRoutineExercise: write(
    ["routines", "restore-exercise"],
    async ({ item, before }: { item: RoutineItem; before: RoutineItem[] }) => {
      await upsertRoutineExercise(stripRow(item));
      const current = removeById(before, item.id);
      await saveRoutineExercisePositions(changedPositions(current, before).map(stripRow));
    },
  ),

  // Biblioteca de exercícios (scope "exercises")
  createExercise: write(["exercises", "create"], async (row: Pick<Exercise, "id" | "name" | "muscle_group">) => {
    await upsertExercise(row);
    return row;
  }),
  updateExercise: write(
    ["exercises", "update"],
    ({ id, name, muscle_group }: Pick<Exercise, "id" | "name" | "muscle_group">) =>
      updateExercise(id, { name, muscle_group }),
  ),

  // Histórico (scope "history")
  updateWorkoutSet: write(["history", "update-set"], ({ id, patch }: { id: string; patch: SetPatch }) =>
    updateWorkoutSet(id, patch),
  ),
  deleteWorkout: write(["history", "delete"], (id: string) => deleteWorkout(id)),

  // Peso corporal (scope "body-weights")
  upsertBodyWeight: write(["body-weights", "upsert"], (entry: BodyWeight) => upsertBodyWeight(entry)),
  deleteBodyWeight: write(["body-weights", "delete"], (day: string) => deleteBodyWeight(day)),

  // Composição corporal (scope "composition"). Sem requisito de offline: o WRITES é a convenção
  // de gravação do projeto. O peso do dia vem junto, pelo trigger do banco.
  addMeasurement: write(["composition", "save-measurement"], (row: MeasurementSave) => upsertMeasurement(row)),
  deleteMeasurement: write(["composition", "delete-measurement"], (id: string) => deleteMeasurement(id)),
  saveCompositionGoal: write(["composition", "save-goal"], (row: CompositionGoalSave) => upsertCompositionGoal(row)),
  updateCompositionGoal: write(
    ["composition", "update-goal"],
    ({ id, patch }: { id: string; patch: CompositionGoalPatch }) => updateCompositionGoal(id, patch),
  ),

  // Registro de refeições (scope "meal-logs")
  logMeal: write(["meal-logs", "log"], (log: MealLog) => upsertMealLog(log)),
  unlogMeal: write(["meal-logs", "unlog"], (v: { day: string; meal_id: string }) => deleteMealLog(v)),
  /**
   * Alimento fora do plano. `log` vem preenchido quando a refeição ainda não tinha registro:
   * cria o registro (fora do plano) antes do item, na mesma gravação, porque o item depende dele.
   */
  addOffPlanItem: write(
    ["meal-logs", "add-item"],
    async ({ log, item }: { day: string; meal_id: string; log: MealLog | null; item: OffPlanItemInsert }) => {
      if (log) await upsertMealLog(log);
      await upsertOffPlanItem(item);
    },
  ),
  removeOffPlanItem: write(["meal-logs", "remove-item"], ({ id }: { day: string; id: string }) => deleteOffPlanItem(id)),

  // Alimentos próprios (scope "meal-logs": um item fora do plano pode depender do alimento recém-criado)
  createFood: write(["foods", "create"], (food: OwnFoodInsert) => upsertOwnFood(food)),

  // Perfil (scope "profile")
  saveProfile: write(["profile", "save"], (row: ProfileSave) => upsertProfile(row)),

  // Plano alimentar (scope "meal-plan")
  createMeal: write(["meal-plan", "create"], (row: MealInsert) => upsertMeal(row)),
  updateMeal: write(["meal-plan", "update"], ({ id, patch }: { id: string; patch: MealPatch }) =>
    updateMeal(id, patch),
  ),
  reorderMeals: write(["meal-plan", "reorder"], (changed: Pick<Meal, "id" | "position">[]) =>
    saveMealPositions(changed),
  ),
  deleteMeal: write(["meal-plan", "delete"], (id: string) => deleteMeal(id)),
  createMealOption: write(["meal-plan", "create-option"], (row: MealOptionInsert) => upsertMealOption(row)),
  updateMealOption: write(
    ["meal-plan", "update-option"],
    ({ id, patch }: { id: string; mealId: string; patch: MealOptionPatch }) => updateMealOption(id, patch),
  ),
  deleteMealOption: write(["meal-plan", "delete-option"], ({ id }: { id: string; mealId: string }) =>
    deleteMealOption(id),
  ),

  // Registro de hábitos (scope "habit-logs")
  logHabit: write(["habit-logs", "log"], ({ log }: { week: string; log: HabitLogInsert }) => upsertHabitLog(log)),
  undoHabitLog: write(["habit-logs", "undo"], ({ ids }: { week: string; ids: string[] }) => deleteHabitLogs(ids)),

  // Hábitos (scope "habits")
  createHabit: write(["habits-edit", "create"], (row: HabitInsert) => upsertHabit(row)),
  updateHabit: write(["habits-edit", "update"], ({ id, patch }: { id: string; patch: HabitPatch }) =>
    updateHabit(id, patch),
  ),
  deleteHabit: write(["habits-edit", "delete"], (id: string) => deleteHabit(id)),

  // Tarefas (scope "tasks")
  saveTask: write(["tasks-edit", "save"], (task: Task) => upsertTask(task)),
  toggleTask: write(["tasks-edit", "toggle"], ({ id, doneAt }: { id: string; doneAt: string | null }) =>
    setTaskDone(id, doneAt),
  ),
  deleteTask: write(["tasks-edit", "delete"], (id: string) => deleteTask(id)),

  // Controle financeiro. Uma compra parcelada entra como um único lote idempotente.
  saveFinanceTransactions: write(["finance", "save-transactions"], (rows: FinanceTransactionSave[]) => saveFinanceTransactions(rows)),
  saveFinanceBudget: write(["finance", "save-budget"], (row: FinanceBudgetSave & { id: string }) => saveFinanceBudget(row)),
  saveFinanceAccount: write(["finance", "save-account"], (row: FinanceAccountSave & { id: string }) => saveFinanceAccount(row)),
  saveFinanceRecurring: write(["finance", "save-recurring"], (row: FinanceRecurringSave & { id: string }) => saveFinanceRecurringRule(row)),
  setFinanceRecurring: write(["finance", "set-recurring"], ({ id, active }: { id: string; active: boolean }) => setFinanceRecurringActive(id, active)),
  createFinanceCategory: write(
    ["finance", "create-category"],
    (row: { id: string; name: string; kind: "income" | "expense"; bucket: "fixed" | "freedom" | "variable" | null; sub_bucket: "comfort" | "pleasures" | "knowledge" | "goals" | null }) => createFinanceCategory(row),
  ),
  setFinancePaid: write(["finance", "set-paid"], ({ id, isPaid }: { id: string; isPaid: boolean }) => setFinanceTransactionPaid(id, isPaid)),
  setFinanceInvoicePaid: write(["finance", "set-invoice-paid"], setFinanceInvoicePaid),
  deleteFinanceTransaction: write(["finance", "delete-transaction"], (id: string) => deleteFinanceTransaction(id)),
};

export type WriteName = keyof typeof WRITES;

/** Mensagem de erro já tratada pela camada de dados (`DataError`) ou genérica. */
function messageOf(error: unknown) {
  return error instanceof Error && error.name === "DataError" ? error.message : "Algo deu errado. Tente de novo.";
}

/**
 * Registra a função de envio de cada gravação pela chave.
 *
 * `onError` e `onSettled` daqui só valem para mutações reidratadas do `localStorage` (o hook
 * que as criou não existe mais): os hooks definem os seus e sobrescrevem estes. Sem saber
 * quais telas a gravação afeta, a última da fila revalida tudo (é raro e o cache é pequeno).
 */
export function registerMutationDefaults(qc: QueryClient) {
  for (const { mutationKey, mutationFn } of Object.values(WRITES)) {
    qc.setMutationDefaults(mutationKey as MutationKey, {
      mutationFn: mutationFn as (v: unknown) => Promise<unknown>,
      onError: (error: unknown) => {
        console.error("[bctrl] gravação pendente falhou", mutationKey, error);
        toast.error(`Uma gravação pendente não foi salva. ${messageOf(error)}`);
      },
      onSettled: () => {
        if (qc.isMutating() <= 1) return qc.invalidateQueries();
      },
    });
  }
}
