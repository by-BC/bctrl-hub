import type { Metadata } from "next";
import { ComingSoon, PageHeader } from "@/components/shell/page-header";

export const metadata: Metadata = { title: "Sessão finalizada" };

export default function TreinoHistoricoIdPage() {
  return (
    <>
      <PageHeader title="Sessão finalizada" eyebrow="Treino" />
      <ComingSoon task="4.0">Detalhe da sessão, com edição.</ComingSoon>
    </>
  );
}
