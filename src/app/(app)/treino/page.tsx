import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/page-header";
import { RoutineList } from "@/features/routines/components/routine-list";
import { StartWorkoutCard } from "@/features/workout-session/components/start-workout-card";

export const metadata: Metadata = { title: "Treino" };

// Dados lidos no cliente (TanStack Query + RLS): o shell continua estático.
export default function TreinoPage() {
  return (
    <>
      <PageHeader title="Treino" eyebrow="Treino" />
      <div className="mb-8">
        <StartWorkoutCard />
      </div>
      <RoutineList />
    </>
  );
}
