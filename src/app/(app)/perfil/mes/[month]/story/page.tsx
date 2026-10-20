import type { Metadata } from "next";
import { Suspense } from "react";
import { MonthStoryScreen, MonthStorySkeleton } from "@/features/story/MonthStoryScreen";

export const metadata: Metadata = { title: "Card do mês" };

// O mês ("AAAA-MM") só existe na requisição: fica atrás do Suspense e o resto do shell é
// pré-renderizado. Os dados vêm no cliente (TanStack Query + RLS).
export default function PerfilMesStoryPage({ params }: PageProps<"/perfil/mes/[month]/story">) {
  return (
    <Suspense fallback={<MonthStorySkeleton />}>
      <MonthStoryFromParams params={params} />
    </Suspense>
  );
}

async function MonthStoryFromParams({ params }: Pick<PageProps<"/perfil/mes/[month]/story">, "params">) {
  const { month } = await params;
  return <MonthStoryScreen month={month} />;
}
