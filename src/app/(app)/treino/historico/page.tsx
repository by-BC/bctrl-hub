import type { Metadata } from "next";
import { ComingSoon, PageHeader } from "@/components/shell/page-header";

export const metadata: Metadata = { title: "Histórico" };

export default function TreinoHistoricoPage() {
  return (
    <>
      <PageHeader title="Histórico" eyebrow="Treino" />
      <ComingSoon task="4.0">Todas as sessões finalizadas.</ComingSoon>
    </>
  );
}
