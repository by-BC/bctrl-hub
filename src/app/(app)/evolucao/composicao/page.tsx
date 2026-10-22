import type { Metadata } from "next";
import { Suspense } from "react";
import { CompositionScreen, CompositionSkeleton } from "@/features/composition/components/composition-screen";
import { BackLink } from "@/features/routines/components/back-link";

export const metadata: Metadata = { title: "Composição" };

// Dados lidos no cliente (TanStack Query + RLS): o shell continua estático.
export default function ComposicaoPage({ searchParams }: PageProps<"/evolucao/composicao">) {
  return (
    <>
      <BackLink href="/evolucao" label="Evolução" />
      <Suspense fallback={<CompositionSkeleton />}>
        <CompositionFromSearchParams searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function CompositionFromSearchParams({ searchParams }: Pick<PageProps<"/evolucao/composicao">, "searchParams">) {
  const params = await searchParams;
  return <CompositionScreen initiallyOpen={params.nova === "1"} />;
}
