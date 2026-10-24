import type { Metadata } from "next";
import { Suspense } from "react";
import { WorkoutStoryScreen } from "@/features/story/WorkoutStoryScreen";

export const metadata: Metadata = { title: "Stories do treino" };

export default function TreinoHistoricoIdStoryPage({ params }: PageProps<"/treino/historico/[id]/story">) {
  return <Suspense fallback={<div className="space-y-4" aria-busy="true" aria-label="Carregando story"><div className="h-10 w-48 animate-pulse rounded bg-muted" /><div className="aspect-[9/16] w-full max-w-[260px] animate-pulse rounded-xl bg-muted" /></div>}><StoryFromParams params={params} /></Suspense>;
}

async function StoryFromParams({ params }: Pick<PageProps<"/treino/historico/[id]/story">, "params">) {
  const { id } = await params;
  return <WorkoutStoryScreen id={id} />;
}
