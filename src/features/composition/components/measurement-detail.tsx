"use client";

import { Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { METRICS } from "@/lib/domain/composition";
import { formatDay } from "@/lib/format";
import type { Measurement } from "../api";
import { useDeleteMeasurement } from "../hooks";
import { formatTime } from "../view";
import { MetricValue } from "./metric-value";

type MeasurementDetailProps = {
  measurement: Measurement | null;
  onOpenChange: (open: boolean) => void;
  onEdit: (m: Measurement) => void;
};

const SOURCE_TEXT = { import: "Importada da balança", manual: "Registro manual" } as const;

/** Detalhe da medição: as 17 métricas com unidade, editar e excluir (com confirmação). */
export function MeasurementDetail({ measurement, onOpenChange, onEdit }: MeasurementDetailProps) {
  return (
    <Sheet open={!!measurement} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="mx-auto max-h-[90dvh] max-w-lg overflow-y-auto rounded-t-2xl">
        {measurement && <DetailBody measurement={measurement} close={() => onOpenChange(false)} onEdit={onEdit} />}
      </SheetContent>
    </Sheet>
  );
}

function DetailBody({ measurement: m, close, onEdit }: { measurement: Measurement; close: () => void; onEdit: (m: Measurement) => void }) {
  const remove = useDeleteMeasurement();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const when = `${formatDay(m.day)}, ${formatTime(m.measured_at)}`;
  const measured = METRICS.filter((d) => m[d.key] !== null).length;

  return (
    <>
      <SheetHeader className="pr-12 text-left">
        <SheetTitle>Medição</SheetTitle>
        <SheetDescription>
          <span className="inline-block first-letter:uppercase">{when}</span> · {SOURCE_TEXT[m.source]} · {measured} de {METRICS.length} métricas
        </SheetDescription>
      </SheetHeader>

      <div className="space-y-4 px-4 pb-6">
        <dl className="divide-y rounded-xl border bg-card" aria-label="Métricas da medição">
          {METRICS.map((def) => {
            const value = m[def.key];
            return (
              <div key={def.key} className="flex items-baseline justify-between gap-3 px-3 py-2.5" data-metric={def.key}>
                <dt className={def.principal ? "text-sm font-medium" : "text-sm text-muted-foreground"}>{def.label}</dt>
                <dd className="text-right text-sm font-semibold">
                  {value === null ? <span className="font-normal text-muted-foreground">não medido</span> : <MetricValue value={value} def={def} />}
                </dd>
              </div>
            );
          })}
        </dl>
        {m.note && <p className="text-sm text-muted-foreground">Nota: {m.note}</p>}

        <div className="flex gap-2">
          <Button type="button" variant="outline" className="h-11 flex-1" onClick={() => onEdit(m)}>
            <Pencil aria-hidden />
            Editar
          </Button>
          <Button type="button" variant="outline" className="h-11 flex-1 text-destructive" onClick={() => setConfirmOpen(true)}>
            <Trash2 aria-hidden />
            Excluir
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Excluir medição?"
        description={`A medição de ${when} sai do histórico e o peso do dia é recalculado pelas outras medições do dia (um peso digitado à mão fica).`}
        confirmLabel="Excluir medição"
        destructive
        onConfirm={() => {
          remove.mutate(m.id);
          close();
        }}
      />
    </>
  );
}
