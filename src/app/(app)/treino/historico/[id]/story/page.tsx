import type { Metadata } from "next";
import { ComingSoon, PageHeader } from "@/components/shell/page-header";

export const metadata: Metadata = { title: "Story" };

export default function TreinoHistoricoIdStoryPage() {
  return (
    <>
      <PageHeader title="Story" eyebrow="Treino" />
      <ComingSoon task="9.0">Story Studio: Recibo, Hex Week, Blueprint e Foto + overlay.</ComingSoon>
    </>
  );
}
