import type { Metadata } from "next";
import { Suspense } from "react";
import { EditorSkeleton, RoutineEditor } from "@/features/routines/components/routine-editor";

export const metadata: Metadata = { title: "Rotina" };

// Sem generateStaticParams, o id só existe na requisição: fica atrás do Suspense
// e o resto do shell é pré-renderizado.
export default function RotinaPage({ params }: PageProps<"/treino/rotinas/[id]">) {
  return (
    <Suspense fallback={<EditorSkeleton />}>
      <EditorFromParams params={params} />
    </Suspense>
  );
}

async function EditorFromParams({ params }: Pick<PageProps<"/treino/rotinas/[id]">, "params">) {
  const { id } = await params;
  return <RoutineEditor id={id} />;
}
