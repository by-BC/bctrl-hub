"use client";

import { ChevronRight, Dumbbell, Trophy } from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { z } from "zod";
import { NumUnit } from "@/components/num-unit";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BackLink } from "@/features/routines/components/back-link";
import { PrBadge } from "@/features/workout-session/components/pr-badge";
import { WarmupBadge } from "@/features/workout-session/components/set-row";
import type { ExerciseType } from "@/lib/domain/exercise-types";
import {
  METRIC_LABEL,
  metricsFor,
  RANGE_LABEL,
  RANGES,
  type ExerciseSession,
  type Metric,
  type PrEntry,
  type Range,
} from "@/lib/domain/stats";
import type { PrKind } from "@/lib/domain/workout";
import { formatDay, formatDistance, formatKg, formatSeconds, formatSet, formatShortDay } from "@/lib/format";
import type { ExerciseBests } from "../api";
import { useExerciseBests, useExerciseHistory, useExerciseStats } from "../hooks";
import { ChartCard, DataTable, Segmented } from "./chart-card";
import { TrendChart, type TrendSeries } from "./trend-chart";

const uuid = z.guid();
const kg = (n: number) => `${formatKg(n)} kg`;
const METRIC_SHORT: Record<Metric, string> = {
  weight: "Carga",
  e1rm: "1RM",
  volume: "Volume",
  distance: "Distância",
  duration: "Tempo",
};
/** Valor com unidade de cada métrica (tooltip, tabela, resumo). */
const METRIC_FORMAT: Record<Metric, (n: number) => string> = {
  weight: kg,
  e1rm: kg,
  volume: kg,
  distance: formatDistance,
  duration: formatSeconds,
};

function EvolucaoBackLink() {
  return <BackLink href="/evolucao" label="Evolução" />;
}

export function ExerciseProgressSkeleton() {
  return (
    <div aria-busy="true" aria-label="Carregando evolução do exercício" className="space-y-4">
      <Skeleton className="h-6 w-24" />
      <Skeleton className="h-9 w-2/3" />
      <div className="grid grid-cols-3 gap-2">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-80 w-full rounded-xl" />
    </div>
  );
}

/** Conteúdo de /evolucao/[exerciseId]: recordes, gráfico por métrica e período, PRs e histórico. */
export function ExerciseProgress({ exerciseId }: { exerciseId: string }) {
  const valid = uuid.safeParse(exerciseId).success;
  const exercise = useExerciseBests(exerciseId, valid);

  if (valid && exercise.isPending) return <ExerciseProgressSkeleton />;
  if (valid && exercise.isError) {
    return (
      <>
        <EvolucaoBackLink />
        <div role="alert" className="space-y-3 rounded-xl border p-5 text-sm">
          <p>Não foi possível carregar o exercício.</p>
          <Button variant="outline" className="h-11" onClick={() => exercise.refetch()}>
            Tentar de novo
          </Button>
        </div>
      </>
    );
  }
  const data = valid ? exercise.data : null;
  if (!data) {
    return (
      <>
        <EvolucaoBackLink />
        <PageHeader title="Exercício não encontrado" />
        <p className="text-sm text-muted-foreground">Ele pode ter sido excluído da biblioteca.</p>
      </>
    );
  }

  return (
    <>
      <EvolucaoBackLink />
      <PageHeader title={data.name} eyebrow="Evolução" />
      {data.muscle_group && <p className="-mt-4 mb-6 text-sm text-muted-foreground">{data.muscle_group}</p>}
      {/* Só reps não tem recorde numérico: a página mostra o histórico de séries. */}
      {data.bests || metricsFor(data.exercise_type).length === 0 ? (
        <div className="space-y-6">
          {data.bests && <BestsGrid bests={data.bests} type={data.exercise_type} />}
          {metricsFor(data.exercise_type).length > 0 && <ExerciseChart exerciseId={exerciseId} type={data.exercise_type} />}
          <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
            <ExerciseRecords exerciseId={exerciseId} type={data.exercise_type} />
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground" data-testid="exercise-empty">
          <Dumbbell aria-hidden className="mb-2 size-5" />
          <p className="font-medium text-foreground">Nenhum treino com este exercício ainda.</p>
          <p className="mt-1">Os gráficos, recordes e o histórico aparecem depois da primeira sessão finalizada.</p>
          <Button asChild variant="outline" className="mt-4 h-11">
            <Link href="/treino">Ir para o treino</Link>
          </Button>
        </div>
      )}
    </>
  );
}

/** Recordes de todos os tempos, só das métricas do tipo do exercício. */
function BestsGrid({ bests, type }: { bests: ExerciseBests; type: ExerciseType }) {
  const all: { metric: Metric; label: string; value: number | null | undefined; text: (n: number) => ReactNode }[] = [
    { metric: "weight", label: "Melhor carga", value: bests.maxWeight, text: (n) => <NumUnit value={formatKg(n)} unit="kg" /> },
    { metric: "e1rm", label: "1RM estimado", value: bests.maxE1rm, text: (n) => <NumUnit value={formatKg(n)} unit="kg" /> },
    {
      metric: "volume",
      label: "Melhor série (volume)",
      value: bests.maxSetVolume,
      text: (n) => <NumUnit value={formatKg(n)} unit="kg" />,
    },
    { metric: "distance", label: "Maior distância", value: bests.maxDistanceM, text: (n) => <span className="num">{formatDistance(n)}</span> },
    { metric: "duration", label: "Maior duração", value: bests.maxDurationS, text: (n) => <span className="num">{formatSeconds(n)}</span> },
  ];
  const metrics = metricsFor(type);
  const items = all.filter((i) => metrics.includes(i.metric) && i.value !== null && i.value !== undefined);
  if (items.length === 0) return null;
  return (
    <dl className="grid grid-cols-3 gap-2" aria-label="Recordes de todos os tempos" data-testid="exercise-bests">
      {items.map((item) => (
        <div key={item.label} className="rounded-xl border bg-card p-3">
          <dt className="text-xs text-muted-foreground">{item.label}</dt>
          <dd className="mt-1 text-base font-semibold sm:text-lg">{item.text(item.value!)}</dd>
        </div>
      ))}
    </dl>
  );
}

type ChartPoint = { day: string; t: number; value: number; workoutId: string };

function ExerciseChart({ exerciseId, type }: { exerciseId: string; type: ExerciseType }) {
  const metrics = metricsFor(type);
  const [chosen, setMetric] = useState<Metric>(metrics[0]);
  const metric = metrics.includes(chosen) ? chosen : metrics[0];
  const [range, setRange] = useState<Range>("3m");
  const stats = useExerciseStats(exerciseId, range);
  const { isPending, isError, isFetching, refetch } = stats;
  const format = METRIC_FORMAT[metric];
  // Treino sem a métrica (ex.: corrida só com tempo, sem distância) fica fora da linha.
  const points: ChartPoint[] | undefined = stats.points?.flatMap((p) =>
    p[metric] === null ? [] : [{ day: p.day, t: p.t, value: p[metric]!, workoutId: p.workoutId }],
  );
  const tablePoints = stats.points ?? [];

  const series: TrendSeries<"value">[] = [
    { key: "value", label: METRIC_LABEL[metric], color: "var(--chart-1)", kind: "line", endLabel: true },
  ];

  return (
    <section aria-label="Gráfico de evolução" className="space-y-3">
      {/* Filtros numa linha, acima do gráfico que eles controlam. */}
      <div className="flex flex-wrap items-center gap-2">
        {metrics.length > 1 && (
          <Segmented
            label="Métrica"
            options={metrics.map((m) => ({ value: m, label: METRIC_SHORT[m] }))}
            value={metric}
            onChange={setMetric}
          />
        )}
        <Segmented
          label="Período"
          options={RANGES.map((r) => ({ value: r, label: RANGE_LABEL[r] }))}
          value={range}
          onChange={setRange}
        />
      </div>

      {isPending || !points ? (
        <Skeleton className="h-80 w-full rounded-xl" />
      ) : isError ? (
        <div role="alert" className="space-y-3 rounded-xl border p-5 text-sm">
          <p>Não foi possível carregar o gráfico.</p>
          <Button variant="outline" className="h-11" onClick={() => refetch()}>
            Tentar de novo
          </Button>
        </div>
      ) : points.length === 0 ? (
        <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground" role="status">
          Nenhum treino com este exercício {range === "all" ? "ainda" : `no período de ${RANGE_LABEL[range].toLowerCase()}`}.
        </div>
      ) : (
        <ChartCard
          title={METRIC_LABEL[metric]}
          subtitle={`${metricHint(metric)} · ${points.length} ${points.length === 1 ? "sessão" : "sessões"} · ${RANGE_LABEL[range].toLowerCase()}`}
          summary={chartSummary(points, metric)}
          refreshing={isFetching}
          chart={<TrendChart data={points} series={series} format={format} showYear={range === "all"} />}
          table={
            <DataTable
              caption={`Evolução por sessão: ${metrics.map((m) => METRIC_LABEL[m].toLowerCase()).join(", ")}`}
              columns={[
                { label: "Dia" },
                ...metrics.map((m) => ({ label: METRIC_SHORT[m], numeric: true })),
                { label: "Séries", numeric: true },
              ]}
              rows={[...tablePoints].reverse().map((p) => ({
                key: p.workoutId,
                cells: [
                  <span key="d" className="num">{formatShortDay(p.day, { year: true })}</span>,
                  ...metrics.map((m) => (p[m] === null ? "—" : METRIC_FORMAT[m](p[m]!))),
                  String(p.sets),
                ],
              }))}
            />
          }
        />
      )}
    </section>
  );
}

function metricHint(metric: Metric) {
  if (metric === "weight") return "maior carga da sessão";
  if (metric === "e1rm") return "melhor série pela fórmula de Epley";
  if (metric === "distance") return "maior distância numa série";
  if (metric === "duration") return "maior duração numa série";
  return "soma de carga × reps da sessão";
}

function chartSummary(points: ChartPoint[], metric: Metric) {
  const format = METRIC_FORMAT[metric];
  const first = points[0];
  const last = points[points.length - 1];
  const max = Math.max(...points.map((p) => p.value));
  const change = last.value - first.value;
  const changeLabel = change === 0 ? "sem alteração" : `${change > 0 ? "+" : "−"}${format(Math.abs(change))}`;
  return `${METRIC_LABEL[metric]} em ${points.length} sessões, de ${formatDay(first.day)} a ${formatDay(last.day)}. De ${format(first.value)} para ${format(last.value)} (variação: ${changeLabel}). Máxima: ${format(max)}.`;
}

function ExerciseRecords({ exerciseId, type }: { exerciseId: string; type: ExerciseType }) {
  const { data, isPending, isError, refetch } = useExerciseHistory(exerciseId);

  if (isPending) {
    return (
      <>
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </>
    );
  }
  if (isError) {
    return (
      <div role="alert" className="space-y-3 rounded-xl border p-5 text-sm lg:col-span-2">
        <p>Não foi possível carregar o histórico do exercício.</p>
        <Button variant="outline" className="h-11" onClick={() => refetch()}>
          Tentar de novo
        </Button>
      </div>
    );
  }
  return (
    <>
      <PrSection prs={data.prs} type={type} />
      <HistorySection sessions={data.sessions} type={type} />
    </>
  );
}

function PrSection({ prs, type }: { prs: PrEntry[]; type: ExerciseType }) {
  return (
    <section aria-labelledby="prs-exercicio" className="space-y-3">
      <h2 id="prs-exercicio" className="flex items-center gap-2 text-lg font-semibold">
        <Trophy aria-hidden className="size-5 text-highlight" />
        Recordes pessoais
      </h2>
      {prs.length === 0 ? (
        <p className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">
          Nenhum recorde batido ainda. O primeiro treino vira a referência; os PRs aparecem quando você superar.
        </p>
      ) : (
        <ol className="space-y-2" aria-label="Recordes, do mais recente ao mais antigo" data-testid="pr-list">
          {prs.map((pr) => (
            <li key={pr.setId} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-card p-3">
              <span>
                <span className="num block font-semibold">{formatSet(pr, type)}</span>
                <span className="block text-xs text-muted-foreground first-letter:uppercase">{formatDay(pr.day)}</span>
              </span>
              <PrBadge kinds={pr.kinds as PrKind[]} />
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function HistorySection({ sessions, type }: { sessions: ExerciseSession[]; type: ExerciseType }) {
  return (
    <section aria-labelledby="historico-exercicio" className="space-y-3">
      <h2 id="historico-exercicio" className="text-lg font-semibold">
        Histórico de séries
      </h2>
      {sessions.length === 0 && (
        <p className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">
          Nenhum treino com este exercício ainda.
        </p>
      )}
      <ol className="space-y-2" aria-label="Sessões, da mais recente à mais antiga">
        {sessions.map((s) => (
          <li key={s.workoutId}>
            <article aria-label={`Sessão de ${formatDay(s.day)}`} className="rounded-xl border bg-card" data-testid="exercise-session">
              <Link
                href={`/treino/historico/${s.workoutId}`}
                className="group flex min-h-11 items-center gap-2 rounded-t-xl px-3 pt-3 pb-1 outline-none hover:text-primary-text focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold first-letter:uppercase">{formatDay(s.day)}</span>
                  <span className="block text-xs text-muted-foreground">{s.routineName ?? "Treino livre"}</span>
                </span>
                <span className="sr-only">Abrir treino</span>
                <ChevronRight aria-hidden className="size-4 text-muted-foreground" />
              </Link>
              <ol className="space-y-1 px-3 pb-3">
                {s.sets.map((set, i) => (
                  <li key={set.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                    <span className="num w-6 text-xs text-muted-foreground">
                      <span className="sr-only">Série </span>
                      {i + 1}
                    </span>
                    <span className="num">{formatSet(storedSet(set), type)}</span>
                    {set.set_type === "warmup" && <WarmupBadge />}
                    <PrBadge kinds={set.pr_kinds as PrKind[]} />
                  </li>
                ))}
              </ol>
            </article>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** Linha de `workout_sets` → valores para `formatSet` (numeric chega como número ou texto). */
function storedSet(set: ExerciseSession["sets"][number]) {
  return {
    weightKg: set.weight_kg === null ? null : Number(set.weight_kg),
    reps: set.reps,
    distanceM: set.distance_m == null ? null : Number(set.distance_m),
    durationS: set.duration_s ?? null,
  };
}
