import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/client";
import { DataError } from "@/features/routines/api";

/** Tarefas simples (supabase-js direto, protegido por RLS). */

type Client = SupabaseClient<Database>;
const db = (): Client => createClient();

export const taskKeys = {
  all: ["tasks"] as const,
  list: () => ["tasks", "list"] as const,
};

export type Task = Pick<Tables<"tasks">, "id" | "title" | "done_at" | "created_at">;

function fail(error: { message: string; code?: string }, message: string): never {
  console.error("[bctrl]", message, error);
  throw new DataError(message, error.code);
}

export async function fetchTasks(client: Client = db()): Promise<Task[]> {
  const { data, error } = await client
    .from("tasks")
    .select("id, title, done_at, created_at")
    .order("created_at", { ascending: false })
    .order("id");
  if (error) fail(error, "Não foi possível carregar as tarefas.");
  return data;
}

/**
 * Cria (ou recria, no "desfazer" da exclusão) a tarefa. Id do cliente + upsert:
 * reenviar não duplica. `defaultToNull: false` mantém o `user_id` do default.
 */
export async function upsertTask(task: Task, client: Client = db()) {
  const { error } = await client.from("tasks").upsert(task, { defaultToNull: false });
  if (error) fail(error, "Não foi possível salvar a tarefa.");
}

export async function setTaskDone(id: string, doneAt: string | null, client: Client = db()) {
  const { error } = await client.from("tasks").update({ done_at: doneAt }).eq("id", id);
  if (error) fail(error, "Não foi possível atualizar a tarefa.");
}

export async function deleteTask(id: string, client: Client = db()) {
  const { error } = await client.from("tasks").delete().eq("id", id);
  if (error) fail(error, "Não foi possível excluir a tarefa.");
}
