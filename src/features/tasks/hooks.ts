"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { DataError } from "@/features/routines/api";
import { weekKeys } from "@/features/week/api";
import { deleteTask, fetchTasks, setTaskDone, taskKeys, upsertTask, type Task } from "./api";

export function useTasks() {
  return useQuery({ queryKey: taskKeys.list(), queryFn: () => fetchTasks() });
}

const TASK_MUTATION_KEY = ["tasks-edit"] as const;

/**
 * Toda gravação de tarefa: otimista na lista, em fila única, desfaz no erro e revalida
 * quando a última termina (o painel Hoje também lê as pendentes).
 */
function useTaskMutation<V>(mutationFn: (v: V) => Promise<void>, apply: (tasks: Task[], v: V) => Task[]) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: TASK_MUTATION_KEY,
    scope: { id: "tasks" },
    mutationFn,
    onMutate: async (vars: V) => {
      await qc.cancelQueries({ queryKey: taskKeys.list() });
      const previous = qc.getQueryData<Task[]>(taskKeys.list());
      qc.setQueryData<Task[]>(taskKeys.list(), (old) => apply(old ?? [], vars));
      return { previous };
    },
    onError: (error, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(taskKeys.list(), ctx.previous);
      toast.error(error instanceof DataError ? error.message : "Algo deu errado. Tente de novo.");
    },
    onSettled: () => {
      if (qc.isMutating({ mutationKey: TASK_MUTATION_KEY }) === 1) {
        return Promise.all([
          qc.invalidateQueries({ queryKey: taskKeys.all }),
          qc.invalidateQueries({ queryKey: weekKeys.all }),
        ]);
      }
    },
  });
}

const byCreatedDesc = (a: Task, b: Task) => b.created_at.localeCompare(a.created_at);

/** Cria a tarefa ou a recria (desfazer exclusão) com o mesmo id. */
export function useSaveTask() {
  return useTaskMutation(
    (task: Task) => upsertTask(task),
    (tasks, task) => [...tasks.filter((t) => t.id !== task.id), task].sort(byCreatedDesc),
  );
}

export function useToggleTask() {
  return useTaskMutation(
    ({ id, doneAt }: { id: string; doneAt: string | null }) => setTaskDone(id, doneAt),
    (tasks, { id, doneAt }) => tasks.map((t) => (t.id === id ? { ...t, done_at: doneAt } : t)),
  );
}

export function useDeleteTask() {
  return useTaskMutation(
    (id: string) => deleteTask(id),
    (tasks, id) => tasks.filter((t) => t.id !== id),
  );
}
