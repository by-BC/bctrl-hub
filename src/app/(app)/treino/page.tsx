import { ChartLine, ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/shell/page-header";
import { RoutineList } from "@/features/routines/components/routine-list";
import { StartWorkoutCard } from "@/features/workout-session/components/start-workout-card";

export const metadata: Metadata = { title: "Treino" };

// Dados lidos no cliente (TanStack Query + RLS): o shell continua estático.
export default function TreinoPage() {
  return (
    <>
      <PageHeader title="Treino" eyebrow="Treino" />
      <div className="mb-8 space-y-3">
        <StartWorkoutCard />
        {/* No celular a Evolução não está na barra inferior: o acesso é por aqui. */}
        <Link
          href="/evolucao"
          className="flex min-h-14 items-center gap-3 rounded-xl border px-4 outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <ChartLine aria-hidden className="size-5 text-primary-text" />
          <span className="min-w-0 flex-1">
            <span className="block font-medium">Evolução</span>
            <span className="block text-xs text-muted-foreground">Gráficos, recordes e peso corporal</span>
          </span>
          <ChevronRight aria-hidden className="size-4 text-muted-foreground" />
        </Link>
      </div>
      <RoutineList />
    </>
  );
}
