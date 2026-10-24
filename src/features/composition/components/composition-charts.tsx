"use client";

import { useMemo, useState } from "react";
import { ChartCard, DataTable, Segmented } from "@/features/progress/components/chart-card";
import { TrendChart, type TrendSeries } from "@/features/progress/components/trend-chart";
import { useToday } from "@/features/progress/use-today";
import { METRIC, PRINCIPAL, type MetricKey } from "@/features/composition/domain/composition";
import { filterByRange, RANGE_LABEL, RANGES, type Range } from "@/lib/domain/stats";
import { formatDay, formatShortDay } from "@/lib/format";
import type { Measurement } from "../api";
import { fatMusclePoints, metricPoints, metricText } from "../view";

/** Rótulos curtos do seletor (cabem em 375 px). */
const SHORT: Partial<Record<MetricKey, string>> = {
  weight_kg: "Peso",
  body_fat_pct: "Gordura",
  skeletal_muscle_kg: "Músculo",
  visceral_fat: "Visceral",
  lean_mass_kg: "Magra",
};

const FAT_MUSCLE: TrendSeries<"fat" | "muscle">[] = [
  { key: "muscle", label: "Músculo esquelético", color: "var(--chart-1)", kind: "line", endLabel: true },
  { key: "fat", label: "Massa de gordura", color: "var(--chart-2)", kind: "line", endLabel: true },
];

const kg = (n: number) => metricText(n, METRIC.fat_mass_kg);
const count = (n: number) => `${n} ${n === 1 ? "medição" : "medições"}`;

/**
 * Gráficos de evolução: uma métrica principal por vez (seletor) e gordura kg × músculo kg, com o
 * mesmo filtro de período (1 mês / 3 meses / tudo) e a tabela "ver dados" de cada um.
 */
export function CompositionCharts({ measurements, refreshing }: { measurements: Measurement[]; refreshing?: boolean }) {
  const today = useToday();
  const [metric, setMetric] = useState<MetricKey>("body_fat_pct");
  const [range, setRange] = useState<Range>("3m");
  const def = METRIC[metric];

  const all = useMemo(() => metricPoints(measurements, metric), [measurements, metric]);
  const points = today ? filterByRange(all, range, today) : all;
  const pairsAll = useMemo(() => fatMusclePoints(measurements), [measurements]);
  const pairs = today ? filterByRange(pairsAll, range, today) : pairsAll;
  const format = (n: number) => metricText(n, def);
  const period = RANGE_LABEL[range].toLowerCase();
  const showYear = range === "all";
  const changeLabel = (first: number, last: number, formatter: (n: number) => string) => {
    const change = last - first;
    return change === 0 ? "sem alteração" : `${change > 0 ? "+" : "−"}${formatter(Math.abs(change))}`;
  };

  return (
    <section aria-labelledby="graficos-composicao" className="space-y-3">
      <h2 id="graficos-composicao" className="text-lg font-semibold">
        Evolução
      </h2>
      <div className="flex flex-wrap gap-2">
        <Segmented
          label="Métrica"
          options={PRINCIPAL.map((k) => ({ value: k, label: SHORT[k] ?? METRIC[k].label }))}
          value={metric}
          onChange={setMetric}
          stretch
        />
        <Segmented label="Período" options={RANGES.map((r) => ({ value: r, label: RANGE_LABEL[r] }))} value={range} onChange={setRange} />
      </div>

      {points.length === 0 ? (
        <EmptyChart>
          {all.length === 0 ? `Nenhuma medição com ${def.label.toLowerCase()} ainda.` : `Nenhuma medição de ${def.label.toLowerCase()} neste período.`}
        </EmptyChart>
      ) : (
        <ChartCard
          title={def.label}
          subtitle={`${count(points.length)} · ${period}${def.unit ? ` · ${def.unit}` : ""}`}
          summary={`${def.label}, ${count(points.length)}. De ${format(points[0].value)} em ${formatDay(points[0].day)} a ${format(points.at(-1)!.value)} em ${formatDay(points.at(-1)!.day)}. Variação: ${changeLabel(points[0].value, points.at(-1)!.value, format)}.`}
          refreshing={refreshing}
          chart={
            <TrendChart
              data={points}
              series={[{ key: "value", label: def.label, color: "var(--chart-1)", kind: "line", endLabel: true }]}
              format={format}
              showYear={showYear}
            />
          }
          table={
            <DataTable
              caption={`${def.label} por medição`}
              columns={[{ label: "Dia" }, { label: def.label, numeric: true }]}
              rows={[...points].reverse().map((p) => ({
                key: p.id,
                cells: [<span key="d" className="num">{formatShortDay(p.day, { year: true })}</span>, format(p.value)],
              }))}
            />
          }
        />
      )}

      {pairs.length === 0 ? (
        <EmptyChart>
          {pairsAll.length === 0
            ? "Gordura × músculo aparece quando as medições tiverem massa de gordura e músculo esquelético em kg."
            : "Nenhuma medição com gordura e músculo em kg neste período."}
        </EmptyChart>
      ) : (
        <ChartCard
          title="Gordura × músculo"
          subtitle={`${count(pairs.length)} · ${period} · kg`}
          legend={FAT_MUSCLE.map(({ label, color, kind }) => ({ label, color, kind }))}
          summary={`Massa de gordura: ${kg(pairs[0].fat)} → ${kg(pairs.at(-1)!.fat)} (variação ${changeLabel(pairs[0].fat, pairs.at(-1)!.fat, kg)}); músculo esquelético: ${kg(pairs[0].muscle)} → ${kg(pairs.at(-1)!.muscle)} (variação ${changeLabel(pairs[0].muscle, pairs.at(-1)!.muscle, kg)}).`}
          refreshing={refreshing}
          chart={<TrendChart data={pairs} series={FAT_MUSCLE} format={kg} showYear={showYear} />}
          table={
            <DataTable
              caption="Massa de gordura e músculo esquelético por medição"
              columns={[{ label: "Dia" }, { label: "Gordura", numeric: true }, { label: "Músculo", numeric: true }]}
              rows={[...pairs].reverse().map((p) => ({
                key: p.id,
                cells: [<span key="d" className="num">{formatShortDay(p.day, { year: true })}</span>, kg(p.fat), kg(p.muscle)],
              }))}
            />
          }
        />
      )}
    </section>
  );
}

function EmptyChart({ children }: { children: string }) {
  return <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">{children}</div>;
}
