"use client";

import { ChevronRight, Dumbbell, Trophy } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { z } from "zod";
import { NumUnit } from "@/components/num-unit";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BackLink } from "@/features/routines/components/back-link";
import { PrBadge } from "@/features/workout-session/components/pr-badge";
import {
  METRIC_LABEL,
  METRICS,
  RANGE_LABEL,
  RANGES,
  type ExerciseSession,
  type Metric,
  type PrEntry,
  type Range,
  type SessionPoint,
} from "@/lib/domain/stats";
import type { PrKind } from "@/lib/domain/workout";
import { formatDay, formatKg, formatShortDay } from "@/lib/format";
import type { ExerciseBests } from "../api";
import { useExerciseBests, useExerciseHistory, useExerciseStats } from "../hooks";
import { ChartCard, DataTable, Segmented } from "./chart-card";
import { TrendChart, type TrendSeries } from "./trend-chart";

const uuid = z.guid();
const kg = (n: number) => `${formatKg(n)} kg`;
const METRIC_SHORT: Record<Metric, string> = { weight: "Carga", e1rm: "1RM", volume: "Volume" };

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
      {data.bests ? (
        <div className="space-y-6">
          <BestsGrid bests={data.bests} />
          <ExerciseChart exerciseId={exerciseId} />
          <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
            <ExerciseRecords exerciseId={exerciseId} />
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

function BestsGrid({ bests }: { bests: ExerciseBests }) {
  const items = [
    { label: "Melhor carga", value: bests.maxWeight },
    { label: "1RM estimado", value: bests.maxE1rm },
    { label: "Melhor série (volume)", value: bests.maxSetVolume },
  ];
  return (
    <dl className="grid grid-cols-3 gap-2" aria-label="Recordes de todos os tempos" data-testid="exercise-bests">
      {items.map((item) => (
        <div key={item.label} className="rounded-xl border bg-card p-3">
          <dt className="text-xs text-muted-foreground">{item.label}</dt>
          <dd className="mt-1 text-base font-semibold sm:text-lg">
            <NumUnit value={formatKg(item.value)} unit="kg" />
          </dd>
        </div>
      ))}
    </dl>
  );
}

function ExerciseChart({ exerciseId }: { exerciseId: string }) {
  const [metric, setMetric] = useState<Metric>("weight");
  const [range, setRange] = useState<Range>("3m");
  const { points, isPending, isError, isFetching, refetch } = useExerciseStats(exerciseId, range);

  const series: TrendSeries<Metric>[] = [
    { key: metric, label: METRIC_LABEL[metric], color: "var(--chart-1)", kind: "line", endLabel: true },
  ];

  return (
    <section aria-label="Gráfico de evolução" className="space-y-3">
      {/* Filtros numa linha, acima do gráfico que eles controlam. */}
      <div className="flex flex-wrap items-center gap-2">
        <Segmented
          label="Métrica"
          options={METRICS.map((m) => ({ value: m, label: METRIC_SHORT[m] }))}
          value={metric}
          onChange={setMetric}
        />
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
          chart={<TrendChart data={points} series={series} format={kg} showYear={range === "all"} />}
          table={
            <DataTable
              caption={`Evolução por sessão: carga, 1RM estimado e volume`}
              columns={[
                { label: "Dia" },
                { label: "Carga", numeric: true },
                { label: "1RM", numeric: true },
                { label: "Volume", numeric: true },
                { label: "Séries", numeric: true },
              ]}
              rows={[...points].reverse().map((p) => ({
                key: p.workoutId,
                cells: [
                  <span key="d" className="num">{formatShortDay(p.day, { year: true })}</span>,
                  kg(p.weight),
                  kg(p.e1rm),
                  kg(p.volume),
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
  return "soma de carga × reps da sessão";
}

function chartSummary(points: SessionPoint[], metric: Metric) {
  const first = points[0];
  const last = points[points.length - 1];
  const max = Math.max(...points.map((p) => p[metric]));
  return `${METRIC_LABEL[metric]} em ${points.length} sessões, de ${formatDay(first.day)} a ${formatDay(last.day)}. Primeira: ${kg(first[metric])}. Última: ${kg(last[metric])}. Máxima: ${kg(max)}.`;
}

function ExerciseRecords({ exerciseId }: { exerciseId: string }) {
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
      <PrSection prs={data.prs} />
      <HistorySection sessions={data.sessions} />
    </>
  );
}

function PrSection({ prs }: { prs: PrEntry[] }) {
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
                <span className="num block font-semibold">
                  {formatKg(pr.weightKg)} kg × {pr.reps}
                </span>
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

function HistorySection({ sessions }: { sessions: ExerciseSession[] }) {
  return (
    <section aria-labelledby="historico-exercicio" className="space-y-3">
      <h2 id="historico-exercicio" className="text-lg font-semibold">
        Histórico de séries
      </h2>
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
                    <span className="num">
                      {formatKg(Number(set.weight_kg))} kg × {set.reps}
                    </span>
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
