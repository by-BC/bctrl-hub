import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/page-header";
import { AchievementsSection } from "@/features/profile/components/achievements";
import { ControlHeatmap } from "@/features/profile/components/control-heatmap";
import { MonthSection } from "@/features/profile/components/month-summary";
import { ProfileCard } from "@/features/profile/components/profile-card";
import { ProfileStories } from "@/features/profile/components/profile-stories";

export const metadata: Metadata = { title: "Perfil" };

// Dados lidos no cliente (TanStack Query + RLS) e o dia calculado no navegador: o shell
// continua estático. Sem params nem searchParams (o mês do resumo é estado do cliente).
// Celular: dados → heatmap → resumo e recordes → conquistas. Desktop: heatmap na largura toda,
// depois resumo e recordes | conquistas.
export default function PerfilPage() {
  return (
    <>
      <PageHeader title="Perfil" eyebrow="Você" />
      <div className="space-y-8">
        <ProfileStories />
        <ProfileCard />
        <ControlHeatmap />
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
          <MonthSection />
          <AchievementsSection />
        </div>
      </div>
    </>
  );
}
