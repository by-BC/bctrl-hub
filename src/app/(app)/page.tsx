import type { Metadata } from "next";
import { ComingSoon, PageHeader } from "@/components/shell/page-header";

export const metadata: Metadata = { title: "Hoje" };

export default function HojePage() {
  return (
    <>
      <PageHeader title="Hoje" eyebrow="Hoje" />
      <ComingSoon task="8.0">Treino sugerido, refeições do dia, hábitos e o Hex Week da semana.</ComingSoon>
    </>
  );
}
