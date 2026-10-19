import type { Metadata } from "next";
import { ComingSoon, PageHeader } from "@/components/shell/page-header";

export const metadata: Metadata = { title: "Tarefas" };

export default function TarefasPage() {
  return (
    <>
      <PageHeader title="Tarefas" eyebrow="To-do" />
      <ComingSoon task="7.0">Lista simples de tarefas.</ComingSoon>
    </>
  );
}
