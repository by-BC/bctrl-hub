import type { Metadata } from "next";
import { ComingSoon, PageHeader } from "@/components/shell/page-header";

export const metadata: Metadata = { title: "Exercício" };

export default function EvolucaoExerciseidPage() {
  return (
    <>
      <PageHeader title="Exercício" eyebrow="Progresso" />
      <ComingSoon task="5.0">Evolução e recordes do exercício.</ComingSoon>
    </>
  );
}
