"use client";

import { Trophy } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PR_LABELS } from "@/features/workout-session/components/pr-badge";
import { monthName } from "@/lib/domain/month-view";
import { formatDistance, formatInt, formatKg, formatSeconds, formatShortDay } from "@/lib/format";
import type { MonthPr, MonthSummary } from "../api";

/** Quantos recordes aparecem antes do "Mostrar todos" (meses do Hevy podem ter dezenas). */
const FIRST = 8;

/** Valor do recorde com unidade, conforme o tipo. */
export function prValueText(pr: Pick<MonthPr, "kind" | "value">): string {
  switch (pr.kind) {
    case "volume":
      return `${formatInt(Math.round(pr.value))} kg`;
    case "duration":
      return formatSeconds(pr.value);
    case "distance":
      return formatDistance(pr.value);
    default:
      return `${formatKg(pr.value)} kg`;
  }
}

/** A série que bateu o recorde, quando ajuda a ler o valor ("80 kg × 5"). */
function setDetail(pr: MonthPr): string | null {
  if (pr.weight_kg !== null && pr.reps !== null && (pr.kind === "volume" || pr.kind === "e1rm" || pr.kind === "weight")) {
    return `${formatKg(pr.weight_kg)} kg × ${pr.reps}`;
  }
  return null;
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Recordes do mês selecionado: exercício, tipo, valor e data. */
export function MonthRecords({ data, month }: { data: MonthSummary | undefined; month: string | null }) {
  const [all, setAll] = useState(false);
  const list = data?.current.prs.list ?? [];
  const shown = all ? list : list.slice(0, FIRST);

  return (
    <section aria-labelledby="recordes-titulo" className="space-y-3">
      <h2 id="recordes-titulo" className="flex items-center gap-2 text-lg font-semibold">
        <Trophy aria-hidden className="size-5 text-highlight" />
        {month ? `Recordes de ${monthName(month)}` : "Recordes do mês"}
      </h2>

      {!data ? (
        <Skeleton role="status" className="h-28 w-full rounded-xl" aria-label="Carregando os recordes do mês" />
      ) : list.length === 0 ? (
        <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
          Nenhum recorde neste mês. Os recordes aparecem aqui assim que você bater uma marca.
        </p>
      ) : (
        <>
          <ul className="divide-y rounded-xl border bg-card" data-testid="month-records">
            {shown.map((pr, i) => {
              const detail = setDetail(pr);
              return (
                <li key={`${pr.day}-${pr.exercise_id}-${pr.kind}-${i}`} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{pr.exercise}</p>
                    <p className="text-xs text-muted-foreground">
                      {capitalize(PR_LABELS[pr.kind])}
                      {detail && <span className="num"> · {detail}</span>}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="num font-semibold">{prValueText(pr)}</p>
                    <p className="num text-xs text-muted-foreground">{formatShortDay(pr.day)}</p>
                  </div>
                </li>
              );
            })}
          </ul>
          {list.length > FIRST && (
            <Button variant="ghost" className="h-11" onClick={() => setAll((v) => !v)} aria-expanded={all}>
              {all ? "Mostrar menos" : `Mostrar todos (${list.length})`}
            </Button>
          )}
        </>
      )}
    </section>
  );
}
