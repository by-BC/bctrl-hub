"use client";

import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Equal, Minus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToday } from "@/features/progress/use-today";
import { canGoNextMonth, monthLabel, type MonthDelta } from "@/lib/domain/month-view";
import { isCompleteProfile } from "@/lib/domain/nutrition";
import { addMonths, monthStart } from "@/lib/domain/week";
import { cn } from "@/lib/utils";
import type { MonthSummary as MonthSummaryData } from "../api";
import { useMonthSummary, useProfile } from "../hooks";
import { summaryStats, type NutritionPair, type Stat } from "../summary-stats";
import { MonthRecords } from "./month-records";

/**
 * Mês selecionado no Perfil: resumo (cartões com variação) e recordes do mesmo mês.
 * Navega para trás à vontade; para frente, até o mês de hoje.
 */
export function MonthSection() {
  const today = useToday();
  const [picked, setPicked] = useState<string | null>(null);
  const month = picked ?? (today ? monthStart(today) : null);
  const summary = useMonthSummary(month);
  const profile = useProfile();

  const isCurrent = !!month && !!today && month === monthStart(today);

  return (
    <div className="space-y-8">
      <section aria-labelledby="resumo-titulo" className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h2 id="resumo-titulo" className="text-lg font-semibold">
              Resumo do mês
            </h2>
            <p aria-live="polite" className="text-sm text-muted-foreground first-letter:uppercase" data-testid="summary-month">
              {month ? `${monthLabel(month)}${isCurrent ? " · até hoje" : ""}` : " "}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="size-11"
              aria-label="Mês anterior"
              disabled={!month}
              onClick={() => month && setPicked(addMonths(month, -1))}
            >
              <ChevronLeft aria-hidden className="size-5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-11"
              aria-label="Próximo mês"
              disabled={!month || !today || !canGoNextMonth(month, today)}
              onClick={() => month && setPicked(addMonths(month, 1))}
            >
              <ChevronRight aria-hidden className="size-5" />
            </Button>
          </div>
        </div>

        {summary.isError ? (
          <div role="alert" className="space-y-3 rounded-xl border p-5 text-sm">
            <p>Não foi possível carregar o resumo do mês.</p>
            <Button variant="outline" className="h-11" onClick={() => summary.refetch()}>
              Tentar de novo
            </Button>
          </div>
        ) : (
          <MonthSummary
            data={summary.data}
            nutrition={summary.nutrition}
            needsProfile={profile.data !== undefined && !isCompleteProfile(profile.data)}
            refreshing={summary.isFetching && !summary.isPending}
          />
        )}
      </section>

      <MonthRecords data={summary.data} month={month} />
    </div>
  );
}

/** Grade dos cartões: 2 colunas (4 no tablet; 2 no desktop, ao lado das conquistas). */
const GRID = "grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-2";

export function MonthSummary({
  data,
  nutrition,
  needsProfile,
  refreshing = false,
}: {
  data: MonthSummaryData | undefined;
  nutrition: NutritionPair;
  needsProfile: boolean;
  refreshing?: boolean;
}) {
  if (!data) {
    return (
      <div className={GRID} role="status" aria-busy="true" aria-label="Carregando o resumo do mês">
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="h-[7.5rem] rounded-xl" />
        ))}
      </div>
    );
  }
  return (
    <>
      {needsProfile && (
        <p className="flex flex-wrap items-center gap-x-2 rounded-xl border border-dashed px-4 py-1 text-sm">
          <span>As metas de kcal e proteína dependem dos seus dados.</span>
          <Link href="/perfil/dados" className="inline-flex min-h-11 items-center font-medium text-primary-text underline underline-offset-2">
            Defina seus dados para ver metas
          </Link>
        </p>
      )}
      <ul className={cn(GRID, refreshing && "opacity-60 transition-opacity")} aria-label="Números do mês">
        {summaryStats(data, nutrition).map((s) => (
          <StatCard key={s.key} stat={s} needsProfile={needsProfile} />
        ))}
      </ul>
    </>
  );
}

function StatCard({ stat, needsProfile }: { stat: Stat; needsProfile: boolean }) {
  const { value } = stat;
  return (
    <li data-testid={`stat-${stat.key}`} className="flex min-h-[7.5rem] flex-col rounded-xl border bg-card p-3 lg:p-4">
      <p className="text-xs font-medium text-muted-foreground">{stat.label}</p>
      <div className="mt-1 min-h-8">
        {value.kind === "loading" ? (
          <Skeleton className="h-7 w-20" />
        ) : value.kind === "empty" ? (
          <p className="pt-1 text-sm font-medium text-muted-foreground">Sem registros</p>
        ) : (
          <p className="text-2xl font-semibold" data-testid="stat-value">
            <span className="num">{value.text}</span>
            {value.unit && (
              <span className={cn("text-sm font-medium text-muted-foreground", value.unit !== "%" && "ml-1")}>{value.unit}</span>
            )}
          </p>
        )}
      </div>
      {stat.detail && <p className="num text-xs text-muted-foreground">{stat.detail}</p>}
      {stat.missingGoal && value.kind === "number" && (
        <p className="text-xs text-muted-foreground">{needsProfile ? "sem meta: defina seus dados" : "sem meta: registre seu peso"}</p>
      )}
      {value.kind !== "loading" && <DeltaLine delta={stat.delta} />}
    </li>
  );
}

const DELTA_ICON = { up: ArrowUp, down: ArrowDown, same: Equal, none: Minus } as const;

/** Variação contra o mês anterior: seta + texto (nunca só cor), em tinta neutra. */
export function DeltaLine({ delta }: { delta: MonthDelta }) {
  const Icon = DELTA_ICON[delta.direction];
  return (
    <p className="mt-auto flex items-center gap-1 pt-2 text-xs text-muted-foreground" data-direction={delta.direction}>
      <Icon aria-hidden className={cn("size-3.5 shrink-0", delta.direction === "up" && "text-primary-text")} />
      <span className="num">{delta.text}</span>
    </p>
  );
}
