import type { Metadata } from "next";
import { ComingSoon, PageHeader } from "@/components/shell/page-header";

export const metadata: Metadata = { title: "Treino" };

export default function TreinoPage() {
  return (
    <>
      <PageHeader title="Treino" eyebrow="Treino" />
      <ComingSoon task="3.0">Suas rotinas Upper/Lower e o próximo treino da sequência.</ComingSoon>
    </>
  );
}
