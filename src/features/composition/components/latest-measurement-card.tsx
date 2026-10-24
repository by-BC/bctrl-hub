"use client";

import { deltas, METRIC, PRINCIPAL } from "@/features/composition/domain/composition";
import { formatDay } from "@/lib/format";
import type { Measurement } from "../api";
import { deltaView, formatTime } from "../view";
import { DeltaText, MetricValue } from "./metric-value";

/**
 * Última medição: as 5 principais, cada uma com a variação desde a primeira medição e contra a
 * anterior (entre as medições que têm a métrica).
 */
export function LatestMeasurementCard({ measurements, onOpen }: { measurements: Measurement[]; onOpen: (m: Measurement) => void }) {
  const latest = measurements.at(-1);
  if (!latest) return null;
  return (
    <section aria-labelledby="ultima-medicao" className="rounded-xl border bg-card p-4 lg:p-5" data-testid="latest-measurement">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 id="ultima-medicao" className="font-semibold">
          Última medição
        </h2>
        <button
          type="button"
          onClick={() => onOpen(latest)}
          className="-mr-2 min-h-11 rounded-md px-2 text-sm text-primary-text underline-offset-4 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <span className="inline-block first-letter:uppercase">{formatDay(latest.day)}</span>, <span className="num">{formatTime(latest.measured_at)}</span>
          <span className="sr-only"> · ver todas as métricas</span>
        </button>
      </div>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-4">
        {PRINCIPAL.map((key) => {
          const def = METRIC[key];
          const value = latest[key];
          const d = deltas(measurements, key);
          return (
            <div key={key} className="min-w-0" data-metric={key}>
              <dt className="text-xs text-muted-foreground">{def.label}</dt>
              <dd className="mt-0.5 text-xl font-semibold">
                {value === null ? <span className="text-sm font-normal text-muted-foreground">não medido</span> : <MetricValue value={value} def={def} />}
              </dd>
              {value !== null && (
                <dd className="mt-1 flex flex-col gap-0.5">
                  <DeltaText delta={deltaView(d.sinceFirst, key, "desde a 1ª")} />
                  <DeltaText delta={deltaView(d.sincePrev, key, "vs anterior")} />
                </dd>
              )}
            </div>
          );
        })}
      </dl>
    </section>
  );
}
