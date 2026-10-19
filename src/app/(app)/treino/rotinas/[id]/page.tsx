import type { Metadata } from "next";
import { ComingSoon, PageHeader } from "@/components/shell/page-header";

export const metadata: Metadata = { title: "Rotina" };

export default function TreinoRotinasIdPage() {
  return (
    <>
      <PageHeader title="Rotina" eyebrow="Treino" />
      <ComingSoon task="3.0">Editor da rotina: exercícios, séries, descanso e observações técnicas.</ComingSoon>
    </>
  );
}
