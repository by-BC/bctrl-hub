import type { Metadata } from "next";
import { Suspense } from "react";
import { StoryScreen, StorySkeleton } from "@/features/story/StoryScreen";

export const metadata: Metadata = { title: "Stories do treino" };

export default function PerfilWorkoutStoriesPage({ params }: PageProps<"/perfil/stories/[id]">) {
  return (
    <Suspense fallback={<StorySkeleton />}>
      <StoryFromParams params={params} />
    </Suspense>
  );
}

async function StoryFromParams({ params }: Pick<PageProps<"/perfil/stories/[id]">, "params">) {
  const { id } = await params;
  return <StoryScreen id={id} />;
}
