import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/page-header";
import { BackLink } from "@/features/routines/components/back-link";
import { ExerciseLibrary } from "@/features/routines/components/exercise-library";

export const metadata: Metadata = { title: "Exercícios" };

export default function ExerciciosPage() {
  return (
    <>
      <BackLink />
      <PageHeader title="Exercícios" eyebrow="Treino" />
      <ExerciseLibrary />
    </>
  );
}
