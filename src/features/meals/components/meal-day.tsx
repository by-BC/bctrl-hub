"use client";

import { ChevronRight, Dumbbell, Pencil } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Segmented } from "@/features/progress/components/chart-card";
import { useToday } from "@/features/progress/use-today";
import { formatMealTime, mealStatus, type Adherence } from "@/lib/domain/meals";
import { addDays } from "@/lib/domain/stats";
import { formatDay } from "@/lib/format";
import type { Meal, MealLog } from "../api";
import { useMealDay, useWeekSummary } from "../hooks";
import { optionLabel, MealSheet } from "./meal-sheet";
import { MealStatusBadge, statusLabel } from "./meal-status";

const DAYS = [
  { value: "-1", label: "Ontem" },
  { value: "0", label: "Hoje" },
  { value: "1", label: "Amanhã" },
] as const;
type DayOffset = (typeof DAYS)[number]["value"];

/** Conteúdo de /comida: refeições do dia em ordem de horário, adesão do dia e da semana. */
export function MealDay() {
  const today = useToday();
  const [offset, setOffset] = useState<DayOffset>("0");
  const day = today ? addDays(today, Number(offset)) : null;

  return (
    <>
      <PageHeader title="Comida" eyebrow="Plano alimentar">
        <Button asChild variant="outline" className="h-11">
          <Link href="/comida/plano">
            <Pencil aria-hidden />
            Editar plano
          </Link>
        </Button>
      </PageHeader>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Segmented label="Dia" options={DAYS} value={offset} onChange={setOffset} />
        {day && (
          <p className="text-sm text-muted-foreground first-letter:uppercase" data-testid="meal-day">
            {formatDay(day)}
          </p>
        )}
      </div>

      {day ? <DayContent key={day} day={day} /> : <DaySkeleton />}
    </>
  );
}

function DayContent({ day }: { day: string }) {
  const { data, isError, refetch } = useMealDay(day);
  const [openMealId, setOpenMealId] = useState<string | null>(null);

  if (isError) {
    return (
      <div role="alert" className="space-y-3 rounded-xl border p-5 text-sm">
        <p>Não foi possível carregar as refeições.</p>
        <Button variant="outline" className="h-11" onClick={() => refetch()}>
          Tentar de novo
        </Button>
      </div>
    );
  }
  if (!data) return <DaySkeleton />;

  const openMeal = data.visible.find((m) => m.id === openMealId) ?? null;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
      <section aria-labelledby="refeicoes-titulo" className="space-y-3 lg:order-1">
        <h2 id="refeicoes-titulo" className="sr-only">
          Refeições
        </h2>
        {data.visible.length === 0 ? (
          <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
            Nenhuma refeição no plano.{" "}
            <Link href="/comida/plano" className="font-medium text-primary-text underline underline-offset-4">
              Cadastre a primeira
            </Link>
            .
          </div>
        ) : (
          <ul className="space-y-2" aria-label="Refeições do dia">
            {data.visible.map((meal) => (
              <li key={meal.id}>
                <MealCard meal={meal} log={data.byMeal.get(meal.id)} onOpen={() => setOpenMealId(meal.id)} />
              </li>
            ))}
          </ul>
        )}
        {data.hiddenTrainingMeals.length > 0 && (
          <p className="flex items-start gap-2 rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
            <Dumbbell aria-hidden className="mt-0.5 size-4 shrink-0" />
            <span>
              {data.hiddenTrainingMeals.map((m) => m.name).join(", ")}{" "}
              {data.hiddenTrainingMeals.length === 1 ? "aparece" : "aparecem"} quando houver treino iniciado ou
              finalizado neste dia.
            </span>
          </p>
        )}
      </section>

      <aside aria-label="Adesão" className="order-first grid grid-cols-2 gap-2 lg:sticky lg:top-10 lg:order-2 lg:grid-cols-1">
        <DayAdherence adherence={data.adherence} />
        <WeekAdherence day={day} />
      </aside>

      <MealSheet
        day={day}
        meal={openMeal}
        log={openMeal ? data.byMeal.get(openMeal.id) : undefined}
        onOpenChange={(open) => !open && setOpenMealId(null)}
      />
    </div>
  );
}

function MealCard({ meal, log, onOpen }: { meal: Meal; log: MealLog | undefined; onOpen: () => void }) {
  const status = mealStatus(log);
  const time = formatMealTime(meal.time);
  const optionIndex = log?.option_id ? meal.meal_options.findIndex((o) => o.id === log.option_id) : -1;
  const detail =
    status === "done"
      ? optionIndex >= 0
        ? `${optionLabel(optionIndex)}: ${meal.meal_options[optionIndex].title}`
        : "opção removida do plano"
      : status === "off_plan"
        ? log?.note
        : null;

  return (
    <button
      type="button"
      onClick={onOpen}
      data-testid="meal-card"
      aria-label={`${meal.name}, ${time ?? "após o treino"}: ${statusLabel(status)}${detail ? `, ${detail}` : ""}`}
      className={`group flex min-h-16 w-full items-center gap-3 rounded-xl border bg-card px-4 py-3 text-left outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 ${
        status === "pending" ? "" : "border-l-4"
      } ${status === "done" ? "border-l-primary" : status === "off_plan" ? "border-l-highlight" : ""}`}
    >
      <span className="num w-12 shrink-0 text-sm text-muted-foreground">
        {time ?? <Dumbbell aria-hidden className="size-4" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold">{meal.name}</span>
        <MealStatusBadge status={status} detail={detail} />
      </span>
      <ChevronRight
        aria-hidden
        className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
      />
    </button>
  );
}

function AdherenceCard({
  title,
  pct,
  summary,
  extra,
  testId,
}: {
  title: string;
  pct: number;
  summary: string;
  extra?: string | null;
  testId: string;
}) {
  return (
    <div className="space-y-2 rounded-xl border bg-card p-4" data-testid={testId}>
      <p className="text-xs text-muted-foreground">{title}</p>
      <p className="num text-2xl font-semibold">{pct}%</p>
      <div aria-hidden className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-highlight transition-[width]" style={{ width: `${pct}%` }} />
      </div>
      <p className="num text-xs text-muted-foreground">{summary}</p>
      {extra && <p className="num text-xs text-highlight-text">{extra}</p>}
    </div>
  );
}

function DayAdherence({ adherence }: { adherence: Adherence }) {
  return (
    <AdherenceCard
      testId="day-adherence"
      title="Adesão do dia"
      pct={adherence.pct}
      summary={`${adherence.done} de ${adherence.planned} no plano`}
      extra={adherence.offPlan > 0 ? `${adherence.offPlan} fora do plano` : null}
    />
  );
}

/** Semana (segunda a domingo) pelo `week_summary`: conta o pós-treino só nos dias com treino finalizado. */
function WeekAdherence({ day }: { day: string }) {
  const { data, isError } = useWeekSummary(day);
  if (isError) {
    return (
      <div className="rounded-xl border bg-card p-4 text-xs text-muted-foreground" role="status">
        Adesão da semana indisponível.
      </div>
    );
  }
  if (!data) return <Skeleton className="h-32 rounded-xl" />;
  return (
    <AdherenceCard
      testId="week-adherence"
      title="Adesão da semana"
      pct={data.meals.pct}
      summary={`${data.meals.done} de ${data.meals.planned} no plano`}
    />
  );
}

export function DaySkeleton() {
  return (
    <div aria-busy="true" aria-label="Carregando refeições" className="space-y-2">
      {Array.from({ length: 5 }, (_, i) => (
        <Skeleton key={i} className="h-16 w-full rounded-xl" />
      ))}
    </div>
  );
}
