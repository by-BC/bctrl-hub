import type { Metadata } from "next";
import { Suspense } from "react";
import { WorkoutDetail, WorkoutDetailSkeleton } from "@/features/history/components/workout-detail";

export const metadata: Metadata = { title: "Sessão finalizada" };

// O id só existe na requisição: fica atrás do Suspense e o resto do shell é pré-renderizado.
export default function TreinoHistoricoIdPage({ params }: PageProps<"/treino/historico/[id]">) {
  return (
    <Suspense fallback={<WorkoutDetailSkeleton />}>
      <DetailFromParams params={params} />
    </Suspense>
  );
}

async function DetailFromParams({ params }: Pick<PageProps<"/treino/historico/[id]">, "params">) {
  const { id } = await params;
  return <WorkoutDetail id={id} />;
}
