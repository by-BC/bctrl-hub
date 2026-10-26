"use client";

import { Hexagon, RotateCw } from "lucide-react";
import { HexLegend, HexProgress } from "@/components/shell/hex-progress";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useWeekSummary } from "@/features/week/hooks";
import { weekDays, weekStart } from "@/lib/domain/week";
import { formatShortDay } from "@/lib/format";
import { hexWeekView } from "../hex-week";

const HEX_SIZE = "size-36 sm:size-44 lg:size-64";

/**
 * Hex Week: a semana (domingo a sábado) no símbolo do Bctrl Hub. Uma chamada ao
 * `week_summary`; as ações rápidas do painel invalidam `weekKeys` e o hex se atualiza.
 * Celular: hex ao lado da legenda; desktop: hex grande em destaque com a legenda abaixo.
 */
export function HexWeekCard({ today }: { today: string | null }) {
  const week = today ? weekStart(today) : null;
  const summary = useWeekSummary(week);
  const days = week ? weekDays(week) : null;

  return (
    <section
      aria-labelledby="hex-week-titulo"
      data-testid="hex-week"
      className="rounded-2xl border bg-card p-4 lg:p-6"
    >
      <header className="mb-4 flex items-baseline justify-between gap-3">
        <h2 id="hex-week-titulo" className="flex items-center gap-2 font-semibold">
          <Hexagon aria-hidden className="size-4 text-primary-text" />
          Hex Week
        </h2>
        <p className="num min-h-5 text-xs text-muted-foreground">
          {days && `${formatShortDay(days[0])} – ${formatShortDay(days[6])}`}
        </p>
      </header>

      {summary.isError ? (
        <div role="alert" className="flex flex-col items-start gap-3 text-sm">
          <p>Não foi possível carregar o resumo da semana.</p>
          <Button variant="outline" className="h-11" onClick={() => summary.refetch()}>
            <RotateCw aria-hidden />
            Tentar de novo
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-4 lg:flex-col lg:items-stretch lg:gap-6">
          {summary.data ? <HexWeekBody view={hexWeekView(summary.data)} /> : <HexWeekSkeleton />}
        </div>
      )}
    </section>
  );
}

function HexWeekBody({ view }: { view: ReturnType<typeof hexWeekView> }) {
  return (
    <>
      <HexProgress segments={view} title="Hex Week: progresso da semana" className={`${HEX_SIZE} shrink-0 lg:mx-auto`} />
      <div className="min-w-0 flex-1">
        <HexLegend
          segments={view}
          details={{ workouts: view.workouts.detail, meals: view.meals.detail, habits: view.habits.detail }}
        />
        {view.empty && (
          <p className="mt-3 text-xs text-muted-foreground" data-testid="hex-empty">
            Semana zerada: cada treino, refeição ou hábito marcado enche um pedaço do hexágono.
          </p>
        )}
      </div>
    </>
  );
}

/** Mesmo tamanho do conteúdo final: o card não pula quando os números chegam. */
function HexWeekSkeleton() {
  return (
    <>
      <Skeleton aria-hidden className={`${HEX_SIZE} shrink-0 rounded-full lg:mx-auto`} />
      <div aria-busy="true" aria-label="Carregando a semana" className="grid min-w-0 flex-1 gap-3">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-24 w-full lg:h-18" />
        ))}
      </div>
    </>
  );
}
