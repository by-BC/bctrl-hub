import type { Metadata } from "next";
import { CompositionScreen } from "@/features/composition/components/composition-screen";
import { BackLink } from "@/features/routines/components/back-link";

export const metadata: Metadata = { title: "Composição" };

// Dados lidos no cliente (TanStack Query + RLS): o shell continua estático.
export default function ComposicaoPage() {
  return (
    <>
      <BackLink href="/evolucao" label="Evolução" />
      <CompositionScreen />
    </>
  );
}
