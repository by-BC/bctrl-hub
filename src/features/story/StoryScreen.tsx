"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { z } from "zod";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { HistoryDetail } from "@/features/history/api";
import { useWorkoutDetail } from "@/features/history/hooks";
import type { WeekSummary } from "@/features/week/api";
import { useWeekSummary } from "@/features/week/hooks";
import { weekStart } from "@/lib/domain/week";
import { storyDataFrom } from "./data";
import { StoryStudio } from "./StoryStudio";

const uuid = z.guid();

function BackLink() {
  return (
    <Link
      href="/perfil"
      className="-ml-2 mb-3 inline-flex min-h-11 items-center gap-1.5 rounded-md px-2 text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      <ArrowLeft aria-hidden className="size-4" />
      Perfil
    </Link>
  );
}

/** Conteúdo dos layouts de treino acessados pelo Perfil. */
export function StoryScreen({ id }: { id: string }) {
  const validId = uuid.safeParse(id).success;
  const detail = useWorkoutDetail(id, validId);
  const workout = validId ? detail.data : null;
  // A semana do próprio treino (não a de hoje): o Hex Week mostra a semana em que ele aconteceu.
  const week = useWeekSummary(workout ? weekStart(workout.day) : null);

  if (validId && (detail.isPending || (workout && week.isPending))) return <StorySkeleton />;
  if (validId && detail.isError) {
    return (
      <>
        <BackLink />
        <div role="alert" className="space-y-3 rounded-xl border p-5 text-sm">
          <p>Não foi possível carregar o treino.</p>
          <Button variant="outline" className="h-11" onClick={() => detail.refetch()}>
            Tentar de novo
          </Button>
        </div>
      </>
    );
  }
  if (!workout) {
    return (
      <>
        <BackLink />
        <PageHeader title="Treino não encontrado" />
        <p className="text-sm text-muted-foreground">Ele pode ter sido excluído.</p>
      </>
    );
  }
  // Sem o resumo da semana (falha de rede), o story sai sem os números da semana.
  return <Studio workout={workout} week={week.data ?? null} />;
}

function Studio({ workout, week }: { workout: HistoryDetail; week: WeekSummary | null }) {
  const data = useMemo(() => storyDataFrom(workout, week), [workout, week]);
  return (
    <>
      <BackLink />
      <PageHeader title="Stories do treino" eyebrow="Perfil" />
      <StoryStudio data={data} />
    </>
  );
}

export function StorySkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Carregando story">
      <Skeleton className="h-10 w-48" />
      <Skeleton className="aspect-[9/16] w-full max-w-[260px] rounded-xl" />
    </div>
  );
}
