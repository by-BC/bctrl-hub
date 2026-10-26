"use client";

import { Flag, LoaderCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { cancelRestPush } from "@/lib/workout-push";
import { NumUnit } from "@/components/num-unit";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { isCountable, type PrKind, type SessionSummary } from "@/lib/domain/workout";
import { formatDuration, formatKg, formatSet } from "@/lib/format";
import { SYNC_TOAST_ID, useWorkoutSync } from "../hooks";
import { hasCountableSet, summaryOf, type ActiveWorkout, type FinishResult } from "../store";
import { PrBadge } from "./pr-badge";

/** Recorde batido na sessão; `set` já formatado pelo tipo ("60 kg × 10", "1:15", "2,5 km · 13:00"). */
export type PrHighlight = { exercise: string; set: string; kinds: PrKind[] };

/** PRs da sessão, para o resumo (antes de o store limpar a sessão). */
export function prHighlights(workout: ActiveWorkout): PrHighlight[] {
  return workout.exercises.flatMap((e) =>
    e.sets
      .filter((s) => isCountable(s, e.exerciseType) && s.prs.length > 0)
      .map((s) => ({ exercise: e.name, set: formatSet(s, e.exerciseType), kinds: s.prs })),
  );
}

type FinishSheetProps = {
  workout: ActiveWorkout;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onFinished: (result: FinishResult, prs: PrHighlight[]) => void;
};

/** Confirmação do fim do treino com a prévia do resumo. Sem rede, o treino fica pendente no aparelho. */
export function FinishSheet({ workout, open, onOpenChange, onFinished }: FinishSheetProps) {
  const { finish } = useWorkoutSync();
  const [saving, setSaving] = useState(false);
  const canFinish = hasCountableSet(workout);
  const skipped = workout.exercises.reduce((n, e) => n + e.sets.filter((s) => !s.done).length, 0);

  async function confirm() {
    setSaving(true);
    const prs = prHighlights(workout);
    try {
      if (workout.rest) {
        void cancelRestPush(workout.id).catch((error: unknown) => {
          console.error("[bctrl] Não foi possível cancelar o aviso push ao finalizar.", error);
        });
      }
      const result = await finish();
      if (result.status === "pending") {
        if (result.retryable) {
          toast.warning("Sem conexão: o treino ficou salvo no aparelho e será enviado quando a rede voltar.", {
            id: SYNC_TOAST_ID,
            duration: 8_000,
          });
        } else {
          toast.error(result.error, { id: SYNC_TOAST_ID, duration: 8_000 });
        }
      }
      onOpenChange(false);
      onFinished(result, prs);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível finalizar o treino.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <SheetContent side="bottom" className="mx-auto max-h-[90dvh] max-w-lg overflow-y-auto rounded-t-2xl">
        {open && (
          <>
            <SheetHeader className="pr-12 text-left">
              <SheetTitle>Finalizar treino?</SheetTitle>
              <SheetDescription>
                {canFinish
                  ? "Confira o resumo. Séries não concluídas não entram no histórico."
                  : "Conclua ao menos uma série (✓) para finalizar o treino."}
              </SheetDescription>
            </SheetHeader>
            <div className="space-y-4 px-4">
              <SummaryGrid summary={summaryOf(workout, new Date().toISOString())} />
              {skipped > 0 && canFinish && (
                <p className="text-sm text-muted-foreground">
                  <span className="num">{skipped}</span> {skipped === 1 ? "série não concluída fica" : "séries não concluídas ficam"} de fora.
                </p>
              )}
            </div>
            <SheetFooter className="gap-2">
              <Button className="h-12 text-base font-semibold" disabled={!canFinish || saving} onClick={confirm}>
                {saving ? <LoaderCircle aria-hidden className="animate-spin" /> : <Flag aria-hidden />}
                {saving ? "Salvando…" : "Salvar treino"}
              </Button>
              <Button variant="outline" className="h-11" disabled={saving} onClick={() => onOpenChange(false)}>
                Continuar treinando
              </Button>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

/** Duração · volume · séries · PRs. */
export function SummaryGrid({ summary }: { summary: SessionSummary }) {
  const items = [
    { label: "Duração", value: formatDuration(summary.durationMin) },
    { label: "Volume", value: <NumUnit value={formatKg(summary.volumeKg)} unit="kg" /> },
    { label: "Séries", value: String(summary.sets) },
    { label: "PRs", value: String(summary.prs) },
  ];
  return (
    <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4" data-testid="workout-summary">
      {items.map((item) => (
        <div key={item.label} className="rounded-xl border bg-card p-3">
          <dt className="text-xs text-muted-foreground">{item.label}</dt>
          <dd className="num mt-1 text-lg font-semibold">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function PrList({ prs }: { prs: PrHighlight[] }) {
  if (prs.length === 0) return null;
  return (
    <section aria-labelledby="prs-titulo" className="space-y-2">
      <h3 id="prs-titulo" className="text-sm font-semibold">
        Recordes batidos
      </h3>
      <ul className="space-y-2">
        {prs.map((pr, i) => (
          <li key={i} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3 text-sm">
            <span className="min-w-0">
              <span className="block font-medium">{pr.exercise}</span>
              <span className="num text-muted-foreground">{pr.set}</span>
            </span>
            <PrBadge kinds={pr.kinds} />
          </li>
        ))}
      </ul>
    </section>
  );
}
