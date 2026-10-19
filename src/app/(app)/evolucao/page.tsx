import type { Metadata } from "next";
import { ComingSoon, PageHeader } from "@/components/shell/page-header";

export const metadata: Metadata = { title: "Evolução" };

export default function EvolucaoPage() {
  return (
    <>
      <PageHeader title="Evolução" eyebrow="Progresso" />
      <ComingSoon task="5.0">Gráficos de carga, 1RM e volume por exercício, e peso corporal.</ComingSoon>
    </>
  );
}
