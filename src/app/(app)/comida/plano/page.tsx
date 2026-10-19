import type { Metadata } from "next";
import { ComingSoon, PageHeader } from "@/components/shell/page-header";

export const metadata: Metadata = { title: "Plano alimentar" };

export default function ComidaPlanoPage() {
  return (
    <>
      <PageHeader title="Plano alimentar" eyebrow="Comida" />
      <ComingSoon task="6.0">Edição das refeições, opções e substituições.</ComingSoon>
    </>
  );
}
