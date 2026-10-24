import type { Metadata } from "next";
import { Suspense } from "react";
import { StoryScreen, StorySkeleton } from "@/features/story/StoryScreen";

export const metadata: Metadata = { title: "Story do treino" };

// O id só existe na requisição: fica atrás do Suspense e o resto do shell é pré-renderizado.
export default function TreinoHistoricoIdStoryPage({ params }: PageProps<"/treino/historico/[id]/story">) {
  return (
    <Suspense fallback={<StorySkeleton />}>
      <StoryFromParams params={params} />
    </Suspense>
  );
}

async function StoryFromParams({ params }: Pick<PageProps<"/treino/historico/[id]/story">, "params">) {
  const { id } = await params;
  return <StoryScreen id={id} />;
}
