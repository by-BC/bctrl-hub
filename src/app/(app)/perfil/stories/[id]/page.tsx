import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

export const metadata: Metadata = { title: "Story do treino" };

/** Compatibilidade com links antigos: um story de sessão pertence ao módulo Treino. */
export default function PerfilWorkoutStoriesPage({ params }: PageProps<"/perfil/stories/[id]">) {
  return <Suspense fallback={<p className="text-sm text-muted-foreground">Abrindo story do treino…</p>}><RedirectToTrainingStory params={params} /></Suspense>;
}

async function RedirectToTrainingStory({ params }: Pick<PageProps<"/perfil/stories/[id]">, "params">): Promise<never> {
  const { id } = await params;
  redirect(`/treino/historico/${id}/story`);
}
