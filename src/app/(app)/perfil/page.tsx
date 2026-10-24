import type { Metadata } from "next";
import { Share2 } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { AchievementsSection } from "@/features/profile/components/achievements";
import { ControlHeatmap } from "@/features/profile/components/control-heatmap";
import { MonthSection } from "@/features/profile/components/month-summary";
import { ProfileCard } from "@/features/profile/components/profile-card";

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
        <Button asChild className="h-11 w-full font-semibold sm:w-auto">
          <Link href="/perfil/story">
            <Share2 aria-hidden />
            Gerar story de hoje
          </Link>
        </Button>
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
