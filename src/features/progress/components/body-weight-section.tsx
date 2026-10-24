"use client";

import { ChevronRight, Plus, Scale, Trash2 } from "lucide-react";
import Link from "next/link";
import { useId, useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { NumUnit } from "@/components/num-unit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { filterByRange, movingAverage, RANGE_LABEL, RANGES, type Range } from "@/lib/domain/stats";
import { formatDay, formatKg, formatShortDay, parseDecimal } from "@/lib/format";
import { useBodyWeights, useDeleteBodyWeight, useUpsertBodyWeight } from "../hooks";
import { useToday } from "../use-today";
import { ChartCard, DataTable, Segmented } from "./chart-card";
import { TrendChart, type TrendSeries } from "./trend-chart";

const MAX_KG = 999.99; // numeric(5,2)
const AVERAGE_WINDOW = 7;

const SERIES: TrendSeries<"value" | "average">[] = [
  { key: "average", label: "Média de 7 dias", color: "var(--chart-1)", kind: "line" },
  { key: "value", label: "Peso do dia", color: "var(--chart-2)", kind: "dots" },
];

const kg = (n: number) => `${formatKg(n)} kg`;

/** Peso corporal: registro rápido (um por dia) e tendência com média móvel de 7 dias. */
export function BodyWeightSection() {
  return (
    <section aria-labelledby="peso-titulo" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <h2 id="peso-titulo" className="flex items-center gap-2 text-lg font-semibold">
          <Scale aria-hidden className="size-5 text-primary-text" />
          Peso corporal
        </h2>
        <Button asChild variant="outline" className="h-11">
          <Link href="/evolucao/composicao">
            Composição corporal
            <ChevronRight aria-hidden />
          </Link>
        </Button>
      </div>
      <BodyWeightForm />
      <BodyWeightTrend />
    </section>
  );
}

function BodyWeightForm() {
  const today = useToday();
  const dayId = useId();
  const kgId = useId();
  const errorId = useId();
  const [day, setDay] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { data } = useBodyWeights();
  const upsert = useUpsertBodyWeight();

  const selectedDay = day ?? today ?? "";

  function submit(e: FormEvent) {
    e.preventDefault();
    const weight = parseDecimal(text);
    if (!selectedDay || (today && selectedDay > today)) {
      setError("Escolha um dia até hoje.");
      return;
    }
    if (weight === null || weight <= 0 || weight > MAX_KG) {
      setError("Informe o peso em kg, por exemplo 82,4.");
      return;
    }
    setError(null);
    const existed = data?.some((w) => w.day === selectedDay) ?? false;
    const rounded = Math.round(weight * 100) / 100;
    upsert.mutate(
      { day: selectedDay, weight_kg: rounded },
      {
        onSuccess: () =>
          toast.success(
            `${existed ? "Peso atualizado" : "Peso registrado"}: ${kg(rounded)} em ${formatShortDay(selectedDay)}.`,
          ),
      },
    );
    setText("");
  }

  return (
    <form onSubmit={submit} noValidate className="rounded-xl border bg-card p-4" aria-label="Registrar peso">
      <div className="grid grid-cols-[1fr_1fr] gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <div className="space-y-1.5">
          <Label htmlFor={dayId}>Dia</Label>
          <Input
            id={dayId}
            type="date"
            value={selectedDay}
            max={today ?? undefined}
            onChange={(e) => setDay(e.target.value)}
            className="num h-11 text-base"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={kgId}>Peso (kg)</Label>
          <Input
            id={kgId}
            inputMode="decimal"
            autoComplete="off"
            placeholder="82,4"
            value={text}
            onChange={(e) => setText(e.target.value)}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            className="num h-11 text-base"
          />
        </div>
        <Button type="submit" className="col-span-2 h-11 font-semibold sm:col-span-1" disabled={!today}>
          <Plus aria-hidden />
          Registrar peso
        </Button>
      </div>
      {error ? (
        <p id={errorId} role="alert" className="mt-2 text-sm text-destructive">
          {error}
        </p>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">Um registro por dia: registrar de novo no mesmo dia substitui.</p>
      )}
    </form>
  );
}

function BodyWeightTrend() {
  const today = useToday();
  const [range, setRange] = useState<Range>("3m");
  const { data, isPending, isError, isFetching, refetch } = useBodyWeights();
  const remove = useDeleteBodyWeight();

  // A média usa todo o histórico; o período só recorta o que aparece.
  const averaged = useMemo(
    () =>
      movingAverage(
        (data ?? []).map((w) => ({ day: w.day, value: w.weight_kg, source: w.source ?? "manual" })),
        AVERAGE_WINDOW,
      ),
    [data],
  );
  const points = today ? filterByRange(averaged, range, today) : averaged;

  if (isPending) return <Skeleton className="h-80 w-full rounded-xl" aria-label="Carregando peso corporal" />;
  if (isError) {
    return (
      <div role="alert" className="space-y-3 rounded-xl border p-5 text-sm">
        <p>Não foi possível carregar o peso corporal.</p>
        <Button variant="outline" className="h-11" onClick={() => refetch()}>
          Tentar de novo
        </Button>
      </div>
    );
  }
  if (averaged.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
        Nenhum peso registrado ainda. O gráfico de tendência aparece a partir do primeiro registro.
      </div>
    );
  }

  const latest = averaged[averaged.length - 1];
  const firstInRange = points[0] ?? latest;
  const latestInRange = points[points.length - 1] ?? latest;
  const averageChange = latestInRange.average - firstInRange.average;
  const averageChangeLabel = averageChange === 0 ? "sem alteração" : `${averageChange > 0 ? "+" : "−"}${kg(Math.abs(averageChange))}`;
  return (
    <div className="space-y-3">
      <dl className="grid grid-cols-2 gap-2" aria-label="Peso atual">
        <div className="rounded-xl border bg-card p-3">
          <dt className="text-xs text-muted-foreground">Último registro · {formatShortDay(latest.day)}</dt>
          <dd className="mt-1 text-lg font-semibold">
            <NumUnit value={formatKg(latest.value)} unit="kg" />
          </dd>
        </div>
        <div className="rounded-xl border bg-card p-3">
          <dt className="text-xs text-muted-foreground">Média de 7 dias</dt>
          <dd className="mt-1 text-lg font-semibold">
            <NumUnit value={formatKg(latest.average)} unit="kg" />
          </dd>
        </div>
      </dl>
      <Segmented
        label="Período do peso corporal"
        options={RANGES.map((r) => ({ value: r, label: RANGE_LABEL[r] }))}
        value={range}
        onChange={setRange}
      />
      {points.length === 0 ? (
        <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
          Nenhum registro neste período. Último: <span className="num">{kg(latest.value)}</span> em{" "}
          {formatShortDay(latest.day, { year: true })}.
        </div>
      ) : (
        <ChartCard
          title="Tendência do peso"
          subtitle={`${points.length} ${points.length === 1 ? "registro" : "registros"} · ${RANGE_LABEL[range].toLowerCase()}`}
          legend={SERIES.map(({ label, color, kind }) => ({ label, color, kind }))}
          summary={`Média móvel de 7 dias: ${kg(firstInRange.average)} em ${formatDay(firstInRange.day)} para ${kg(latestInRange.average)} em ${formatDay(latestInRange.day)} (variação: ${averageChangeLabel}). Último registro neste período: ${kg(latestInRange.value)}.`}
          refreshing={isFetching}
          chart={<TrendChart data={points} series={SERIES} format={kg} showYear={range === "all"} />}
          table={
            <DataTable
              caption="Peso corporal por dia"
              columns={[{ label: "Dia · origem" }, { label: "Peso", numeric: true }, { label: "Média 7 dias", numeric: true }, { label: "" }]}
              rows={[...points].reverse().map((p) => ({
                key: p.day,
                cells: [
                  // Origem do peso do dia: medição da balança (trigger) ou digitado.
                  <span key="d" className="flex flex-col">
                    <span className="num">{formatShortDay(p.day, { year: true })}</span>
                    <span className="text-xs text-muted-foreground">{p.source === "scale" ? "Balança" : "Manual"}</span>
                  </span>,
                  `${formatKg(p.value)} kg`,
                  `${formatKg(p.average)} kg`,
                  // O peso da balança sai excluindo a medição, em Composição.
                  p.source === "scale" ? null : (
                    <Button
                      key="x"
                      variant="ghost"
                      size="icon"
                      className="size-11 text-muted-foreground hover:text-destructive"
                      aria-label={`Excluir peso de ${formatDay(p.day)}`}
                      onClick={() => remove.mutate(p.day)}
                    >
                      <Trash2 aria-hidden />
                    </Button>
                  ),
                ],
              }))}
            />
          }
        />
      )}
    </div>
  );
}
