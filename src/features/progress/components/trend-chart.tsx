"use client";

import { CartesianGrid, Line, LineChart, Tooltip, XAxis, YAxis, type TooltipContentProps } from "recharts";
import { niceAxis } from "@/lib/domain/stats";
import { formatCompact, formatDay, formatShortDay } from "@/lib/format";

/**
 * Gráfico de tendência no tempo (Recharts 3), no padrão da skill dataviz:
 * linha de 2 px, marcadores ≥ 8 px com anel da cor da superfície, grade horizontal
 * fina e recessiva, um eixo só, rótulo direto apenas no último ponto e tooltip com
 * todas as séries do dia (o valor em destaque, o nome depois).
 * Cores só por tokens (`--chart-*`), validadas nos temas claro e escuro.
 */

export type TrendSeries<K extends string> = {
  key: K;
  label: string;
  /** Token de cor, ex.: "var(--chart-1)". */
  color: string;
  /** "line" = linha com pontos; "dots" = só pontos (registros soltos). */
  kind: "line" | "dots";
  /** Recebe o rótulo direto no último ponto. */
  endLabel?: boolean;
};

export type TrendPoint<K extends string> = { day: string; t: number } & Record<K, number>;

type TrendChartProps<K extends string> = {
  data: TrendPoint<K>[];
  series: TrendSeries<K>[];
  /** Formata valores no tooltip e no rótulo direto (com unidade). */
  format: (value: number) => string;
  /** Mostra o ano nos ticks (períodos longos). */
  showYear?: boolean;
  height?: number;
};

const DAY_MS = 86_400_000;

/** Um ponto só: abre ±3 dias para ele não colar na borda. */
function xDomain(data: { t: number }[]): [number, number] {
  const ts = data.map((d) => d.t);
  const min = Math.min(...ts);
  const max = Math.max(...ts);
  return min === max ? [min - 3 * DAY_MS, max + 3 * DAY_MS] : [min, max];
}

const dayOf = (t: number) => new Date(t).toISOString().slice(0, 10);

export function TrendChart<K extends string>({ data, series, format, showYear = false, height = 240 }: TrendChartProps<K>) {
  const last = data.length - 1;
  const y = niceAxis(data.flatMap((d) => series.map((s) => d[s.key])));

  return (
    <div
      // Texto do SVG em tokens: ticks em mono tabular e cor de texto secundária.
      className="[&_.recharts-cartesian-axis-tick-value]:fill-muted-foreground [&_.recharts-cartesian-axis-tick-value]:font-mono [&_.recharts-cartesian-axis-tick-value]:text-xs [&_.recharts-cartesian-axis-tick-value]:tabular-nums [&_.recharts-surface]:outline-none [&_.recharts-surface:focus-visible]:rounded-md [&_.recharts-surface:focus-visible]:ring-[3px] [&_.recharts-surface:focus-visible]:ring-ring/50"
    >
      <LineChart
        responsive
        data={data}
        margin={{ top: 20, right: showYear ? 28 : 16, bottom: 0, left: 0 }}
        style={{ width: "100%", height }}
      >
        <CartesianGrid vertical={false} stroke="var(--border)" strokeWidth={1} />
        <XAxis
          dataKey="t"
          type="number"
          scale="time"
          domain={xDomain(data)}
          padding={{ left: 12, right: 12 }}
          tickFormatter={(t: number) => formatShortDay(dayOf(t), { year: showYear })}
          tickLine={false}
          axisLine={{ stroke: "var(--border)" }}
          minTickGap={28}
          tickMargin={8}
        />
        <YAxis
          width={48}
          domain={y.domain}
          ticks={y.ticks}
          allowDataOverflow={false}
          tickFormatter={formatCompact}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          cursor={{ stroke: "var(--muted-foreground)", strokeWidth: 1 }}
          isAnimationActive={false}
          content={(props: TooltipContentProps) => <ChartTooltip {...props} series={series} format={format} />}
        />
        {series.map((s) => (
          <Line
            key={s.key}
            dataKey={s.key}
            name={s.label}
            type="linear"
            stroke={s.kind === "line" ? s.color : "transparent"}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            dot={{ r: s.kind === "line" ? 4 : 4.5, fill: s.color, stroke: "var(--card)", strokeWidth: 2, fillOpacity: 1 }}
            activeDot={{ r: 6, fill: s.color, stroke: "var(--card)", strokeWidth: 2 }}
            isAnimationActive={false}
            label={
              s.endLabel
                ? ({ x, y, index, value }: { x?: number | string; y?: number | string; index?: number; value?: unknown }) =>
                    index === last && typeof value === "number" ? (
                      <text
                        key="end-label"
                        x={Number(x)}
                        y={Number(y) - 12}
                        textAnchor="end"
                        className="fill-foreground font-mono text-xs font-semibold tabular-nums"
                      >
                        {format(value)}
                      </text>
                    ) : null
                : undefined
            }
          />
        ))}
      </LineChart>
    </div>
  );
}

function ChartTooltip<K extends string>({
  active,
  payload,
  label,
  series,
  format,
}: TooltipContentProps & { series: TrendSeries<K>[]; format: (value: number) => string }) {
  if (!active || !payload?.length || typeof label !== "number") return null;
  const row = payload[0]?.payload as TrendPoint<K> | undefined;
  if (!row) return null;
  return (
    <div className="min-w-36 rounded-lg border bg-popover px-3 py-2 text-popover-foreground shadow-md">
      <p className="mb-1 text-xs text-muted-foreground first-letter:uppercase">{formatDay(row.day)}</p>
      <ul className="space-y-1">
        {series.map((s) => (
          <li key={s.key} className="flex items-center gap-2 text-sm">
            <span aria-hidden className="h-0.5 w-3 shrink-0 rounded-full" style={{ background: s.color }} />
            <span className="num font-semibold">{format(row[s.key])}</span>
            <span className="text-xs text-muted-foreground">{s.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
