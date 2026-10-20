import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/page-header";
import { ExerciseCatalog } from "@/features/exercises/components/exercise-catalog";
import { BackLink } from "@/features/routines/components/back-link";

export const metadata: Metadata = { title: "Exercícios" };

export default function ExerciciosPage() {
  return (
    <>
      <BackLink />
      <PageHeader title="Exercícios" eyebrow="Treino" />
      <ExerciseCatalog />
    </>
  );
}
