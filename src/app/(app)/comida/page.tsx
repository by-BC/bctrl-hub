import type { Metadata } from "next";
import { ComingSoon, PageHeader } from "@/components/shell/page-header";

export const metadata: Metadata = { title: "Comida" };

export default function ComidaPage() {
  return (
    <>
      <PageHeader title="Comida" eyebrow="Plano alimentar" />
      <ComingSoon task="6.0">Refeições do dia: escolha a opção e marque como feita.</ComingSoon>
    </>
  );
}
