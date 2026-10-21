"use client";

import { ChevronRight, Plus, Scale } from "lucide-react";
import { useState } from "react";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { METRIC } from "@/lib/domain/composition";
import { formatShortDay } from "@/lib/format";
import type { Measurement } from "../api";
import { useMeasurements } from "../hooks";
import { formatTime } from "../view";
import { CompositionCharts } from "./composition-charts";
import { CompositionGoals } from "./composition-goals";
import { LatestMeasurementCard } from "./latest-measurement-card";
import { MeasurementDetail } from "./measurement-detail";
import { MeasurementSheet } from "./measurement-sheet";
import { MetricValue } from "./metric-value";

const LIST_STEP = 10;

/** Conteúdo de /evolucao/composicao: última medição, gráficos, lista e os sheets. */
export function CompositionScreen() {
  const { data, isPending, isError, isFetching, refetch } = useMeasurements();
  const [form, setForm] = useState<{ open: boolean; measurement: Measurement | null }>({ open: false, measurement: null });
  const [detailId, setDetailId] = useState<string | null>(null);
  // O detalhe acompanha a lista (a medição editada aparece atualizada; a excluída fecha o sheet).
  const detail = data?.find((m) => m.id === detailId) ?? null;

  const newButton = (
    <Button className="h-11 font-semibold" onClick={() => setForm({ open: true, measurement: null })}>
      <Plus aria-hidden />
      Nova medição
    </Button>
  );

  return (
    <>
      <PageHeader title="Composição" eyebrow="Evolução">
        <div className="hidden sm:block">{newButton}</div>
      </PageHeader>
      <div className="-mt-2 mb-4 sm:hidden [&>button]:w-full">{newButton}</div>

      {isPending ? (
        <CompositionSkeleton />
      ) : isError ? (
        <div role="alert" className="space-y-3 rounded-xl border p-5 text-sm">
          <p>Não foi possível carregar as medições.</p>
          <Button variant="outline" className="h-11" onClick={() => refetch()}>
            Tentar de novo
          </Button>
        </div>
      ) : data.length === 0 ? (
        <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground" data-testid="composition-empty">
          <Scale aria-hidden className="mb-2 size-5" />
          <p className="font-medium text-foreground">Nenhuma medição ainda.</p>
          <p className="mt-1">
            Registre a primeira com os números da balança de bioimpedância: o card, os gráficos e o peso do dia aparecem a partir dela.
          </p>
        </div>
      ) : (
        // Celular: card → metas → gráficos → lista. A partir de 1024 px: card, metas e lista | gráficos.
        <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
          <div className="contents lg:block lg:space-y-6">
            <div className="order-1">
              <LatestMeasurementCard measurements={data} onOpen={(m) => setDetailId(m.id)} />
            </div>
            <div className="order-2">
              <CompositionGoals measurements={data} />
            </div>
            <div className="order-4">
              <MeasurementList measurements={data} onOpen={(m) => setDetailId(m.id)} />
            </div>
          </div>
          <div className="order-3 lg:order-none">
            <CompositionCharts measurements={data} refreshing={isFetching} />
          </div>
        </div>
      )}

      <MeasurementDetail
        measurement={detail}
        onOpenChange={(open) => !open && setDetailId(null)}
        onEdit={(m) => {
          setDetailId(null);
          setForm({ open: true, measurement: m });
        }}
      />
      <MeasurementSheet
        open={form.open}
        measurement={form.measurement}
        onOpenChange={(open) => setForm((f) => ({ ...f, open }))}
      />
    </>
  );
}

/** Esqueleto com a mesma altura do conteúdo (card, lista e gráfico): nada pula ao carregar. */
export function CompositionSkeleton() {
  return (
    <div aria-busy="true" aria-label="Carregando medições" className="grid gap-6 lg:grid-cols-2 lg:items-start">
      <div className="contents lg:block lg:space-y-6">
        <Skeleton className="order-1 h-72 w-full rounded-xl" />
        <Skeleton className="order-3 h-64 w-full rounded-xl" />
      </div>
      <div className="order-2 space-y-3 lg:order-none">
        <Skeleton className="h-7 w-28" />
        <Skeleton className="h-24 w-full rounded-lg" />
        <Skeleton className="h-80 w-full rounded-xl" />
      </div>
    </div>
  );
}

function MeasurementList({ measurements, onOpen }: { measurements: Measurement[]; onOpen: (m: Measurement) => void }) {
  const [limit, setLimit] = useState(LIST_STEP);
  const recent = [...measurements].reverse();
  const shown = recent.slice(0, limit);
  return (
    <section aria-labelledby="medicoes-titulo" className="space-y-2">
      <h2 id="medicoes-titulo" className="text-lg font-semibold">
        Medições <span className="num text-sm font-normal text-muted-foreground">({measurements.length})</span>
      </h2>
      <ul className="divide-y rounded-xl border bg-card" aria-label="Medições, mais recente primeiro">
        {shown.map((m) => (
          <li key={m.id}>
            <button
              type="button"
              data-testid="measurement-item"
              onClick={() => onOpen(m)}
              className="flex min-h-12 w-full items-center gap-3 px-3 py-2 text-left outline-none hover:bg-muted/60 focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <span className="num min-w-0 flex-1 text-sm">
                {formatShortDay(m.day, { year: true })} <span className="text-muted-foreground">{formatTime(m.measured_at)}</span>
              </span>
              <MetricValue value={m.weight_kg} def={METRIC.weight_kg} className="text-sm font-semibold" />
              <span className="w-16 text-right text-sm text-muted-foreground">
                {m.body_fat_pct === null ? (
                  <>
                    <span aria-hidden>—</span>
                    <span className="sr-only">gordura não medida</span>
                  </>
                ) : (
                  <MetricValue value={m.body_fat_pct} def={METRIC.body_fat_pct} />
                )}
              </span>
              <ChevronRight aria-hidden className="size-4 shrink-0 text-muted-foreground" />
            </button>
          </li>
        ))}
      </ul>
      {recent.length > limit && (
        <Button variant="ghost" className="h-11" onClick={() => setLimit((n) => n + LIST_STEP * 3)}>
          Mostrar mais ({recent.length - limit})
        </Button>
      )}
    </section>
  );
}
