import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/page-header";
import { BodyWeightSection } from "@/features/progress/components/body-weight-section";
import { ProgressList } from "@/features/progress/components/progress-list";

export const metadata: Metadata = { title: "Evolução" };

// Dados lidos no cliente (TanStack Query + RLS): o shell continua estático.
// Celular: peso primeiro (registro rápido). A partir de 1024 px: exercícios | peso.
export default function EvolucaoPage() {
  return (
    <>
      <PageHeader title="Evolução" eyebrow="Progresso" />
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-2 lg:items-start">
        <div className="min-w-0 lg:sticky lg:top-10 lg:order-2">
          <BodyWeightSection />
        </div>
        <div className="min-w-0 lg:order-1">
          <ProgressList />
        </div>
      </div>
    </>
  );
}
