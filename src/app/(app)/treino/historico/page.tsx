import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/page-header";
import { HistoryList } from "@/features/history/components/history-list";
import { BackLink } from "@/features/routines/components/back-link";

export const metadata: Metadata = { title: "Histórico" };

// Dados lidos no cliente (TanStack Query + RLS): o shell continua estático.
export default function TreinoHistoricoPage() {
  return (
    <>
      <BackLink />
      <PageHeader title="Histórico" eyebrow="Treino" />
      <HistoryList />
    </>
  );
}
