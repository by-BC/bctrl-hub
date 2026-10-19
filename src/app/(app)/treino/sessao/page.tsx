import type { Metadata } from "next";
import { ComingSoon, PageHeader } from "@/components/shell/page-header";

export const metadata: Metadata = { title: "Sessão" };

export default function TreinoSessaoPage() {
  return (
    <>
      <PageHeader title="Sessão" eyebrow="Treino" />
      <ComingSoon task="4.0">Registro ao vivo: carga anterior, timer de descanso e recordes.</ComingSoon>
    </>
  );
}
