import type { Metadata } from "next";
import { TaskList } from "@/features/tasks/components/task-list";

export const metadata: Metadata = { title: "Tarefas" };

// Dados lidos no cliente (TanStack Query + RLS): o shell continua estático.
export default function TarefasPage() {
  return <TaskList />;
}
