import type { Metadata } from "next";
import { Suspense } from "react";
import { ExerciseProgress, ExerciseProgressSkeleton } from "@/features/progress/components/exercise-progress";

export const metadata: Metadata = { title: "Evolução do exercício" };

// O id só existe na requisição: fica atrás do Suspense e o resto do shell é pré-renderizado.
export default function EvolucaoExercicioPage({ params }: PageProps<"/evolucao/[exerciseId]">) {
  return (
    <Suspense fallback={<ExerciseProgressSkeleton />}>
      <ExerciseFromParams params={params} />
    </Suspense>
  );
}

async function ExerciseFromParams({ params }: Pick<PageProps<"/evolucao/[exerciseId]">, "params">) {
  const { exerciseId } = await params;
  return <ExerciseProgress exerciseId={exerciseId} />;
}
