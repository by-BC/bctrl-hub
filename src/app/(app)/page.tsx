import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/page-header";
import { TodayPanel } from "@/features/today/components/today-panel";

export const metadata: Metadata = { title: "Hoje" };

// Cabeçalho estático no shell; os dados são lidos no cliente (TanStack Query + RLS) com o
// dia calculado no navegador (America/Sao_Paulo), como nas outras telas. Prefetch no
// servidor exigiria ler a sessão (cookies) e tiraria o painel do shell estático.
export default function HojePage() {
  return (
    <>
      <PageHeader title="Hoje" eyebrow="Painel" />
      <TodayPanel />
    </>
  );
}
