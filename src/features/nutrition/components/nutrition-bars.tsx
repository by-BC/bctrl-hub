"use client";

import { CircleAlert, CircleCheck, Dumbbell, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { macroProgress, type MacroKey, type MacroProgress, type Macros } from "@/features/nutrition/domain/nutrition";
import { cn } from "@/lib/utils";
import { useDayNutrition } from "../hooks";
import { unresolvedLabel } from "./macro-summary";

const int = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const one = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

const LABEL: Record<MacroKey, string> = { kcal: "Calorias", protein: "Proteína", carbs: "Carboidrato", fat: "Gordura" };
const UNIT: Record<MacroKey, string> = { kcal: "kcal", protein: "g", carbs: "g", fat: "g" };
const fmt = (key: MacroKey, n: number) => (key === "kcal" ? int.format(n) : one.format(n));

/**
 * Consumido × meta de kcal e de cada macro: medidor de uma cor (trilha neutra, preenchimento
 * azul) até a meta. Passou da meta, a barra fica cheia em laranja e a linha diz "acima da meta"
 * com ícone: o estado nunca depende só da cor. Os números ficam em texto, fora da barra.
 */
export function NutritionBars({
  consumed,
  goal,
  className,
}: {
  consumed: Macros;
  goal: Macros;
  className?: string;
}) {
  const rows = macroProgress(consumed, goal);
  return (
    <ul className={cn("grid gap-3", className)} aria-label="Consumido e meta do dia" data-testid="nutrition-bars">
      {rows.map((row) => (
        <BarRow key={row.key} row={row} />
      ))}
    </ul>
  );
}

function BarRow({ row }: { row: MacroProgress }) {
  const { key, consumed, goal, ratio, remaining, excess } = row;
  const unit = UNIT[key];
  const over = excess > 0;
  const width = Math.min(1, ratio) * 100;
  return (
    <li className="space-y-1.5" data-testid={`nutrition-${key}`} data-state={over ? "over" : remaining > 0 ? "under" : "met"}>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="font-medium">{LABEL[key]}</span>
        <span className="num text-muted-foreground">
          <span className="font-semibold text-foreground" data-testid="nutrition-consumed">
            {fmt(key, consumed)}
          </span>{" "}
          / {fmt(key, goal)} {unit}
        </span>
      </div>
      <div aria-hidden className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full transition-[width]", over ? "bg-highlight" : "bg-chart-1")}
          style={{ width: `${width}%` }}
        />
      </div>
      <p className="num flex items-center gap-1 text-xs" data-testid="nutrition-status">
        {over ? (
          <span className="flex items-center gap-1 font-medium text-highlight-text">
            <TriangleAlert aria-hidden className="size-3.5 shrink-0" />
            Acima da meta: +{fmt(key, excess)} {unit}
          </span>
        ) : remaining > 0 ? (
          <span className="text-muted-foreground">
            Faltam {fmt(key, remaining)} {unit}
          </span>
        ) : (
          <span className="flex items-center gap-1 font-medium text-primary-text">
            <CircleCheck aria-hidden className="size-3.5 shrink-0" />
            Meta atingida
          </span>
        )}
      </p>
    </li>
  );
}

/**
 * Bloco do dia (Comida e painel Hoje): busca tudo e mostra as barras, ou o que falta para
 * calcular a meta (perfil ou peso), sempre com o consumido.
 */
export function DayNutrition({
  day,
  headingLevel = 2,
  className,
}: {
  day: string;
  /** 3 quando o bloco fica dentro de outra seção (painel Hoje). */
  headingLevel?: 2 | 3;
  className?: string;
}) {
  const data = useDayNutrition(day);
  const Heading = headingLevel === 2 ? "h2" : "h3";

  if (data.state === "error") {
    return (
      <div role="alert" className={cn("space-y-3 rounded-xl border bg-card p-4 text-sm", className)}>
        <p>Não foi possível carregar as metas do dia.</p>
        <Button variant="outline" className="h-11" onClick={() => data.retry()}>
          Tentar de novo
        </Button>
      </div>
    );
  }
  if (data.state === "loading") return <Skeleton className={cn("h-56 rounded-xl", className)} aria-label="Carregando metas" />;

  const { consumed, goal, missing, trainingDay, unresolved } = data;
  return (
    <section
      aria-labelledby="metas-titulo"
      className={cn("space-y-3 rounded-xl border bg-card p-4", className)}
      data-testid="day-nutrition"
    >
      <header className="flex flex-wrap items-center justify-between gap-2">
        <Heading id="metas-titulo" className="text-sm font-semibold">
          Consumido × meta
        </Heading>
        {trainingDay && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground" data-testid="training-day">
            <Dumbbell aria-hidden className="size-3.5" />
            Dia de treino
          </span>
        )}
      </header>

      {goal ? (
        <NutritionBars consumed={consumed} goal={goal} />
      ) : (
        <div className="space-y-2 text-sm" data-testid="nutrition-missing">
          <p className="num text-muted-foreground">
            Consumido: <span className="font-semibold text-foreground">{int.format(Math.round(consumed.kcal))} kcal</span> · P{" "}
            {one.format(consumed.protein)} g · C {one.format(consumed.carbs)} g · G {one.format(consumed.fat)} g
          </p>
          {missing === "profile" ? (
            <p>
              Para ver as metas,{" "}
              <Link href="/perfil/dados" className="font-medium text-primary-text underline underline-offset-4">
                preencha seus dados
              </Link>
              .
            </p>
          ) : (
            <p>
              Para calcular as metas,{" "}
              <Link href="/evolucao" className="font-medium text-primary-text underline underline-offset-4">
                registre seu peso
              </Link>
              .
            </p>
          )}
        </div>
      )}

      {unresolved > 0 && (
        <p className="flex items-center gap-1 text-xs font-medium text-highlight-text" data-testid="nutrition-unresolved">
          <CircleAlert aria-hidden className="size-3.5 shrink-0" />
          {unresolvedLabel(unresolved)} nas opções marcadas (fora do total)
        </p>
      )}
      {goal && (
        <Link
          href="/perfil/dados"
          className="-my-2 inline-flex min-h-11 items-center text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
        >
          Ajustar metas
        </Link>
      )}
    </section>
  );
}
