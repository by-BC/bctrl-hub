"use client";

import { ChevronRight, Trophy } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDay, formatDuration, formatKg } from "@/lib/format";
import { useHistory } from "../hooks";
import { summarizeStored } from "../summary";

/** Conteúdo de /treino/historico: sessões finalizadas, da mais recente para a mais antiga. */
export function HistoryList() {
  const { data, isPending, isError, refetch } = useHistory();

  if (isPending) {
    return (
      <div className="space-y-2" aria-busy="true" aria-label="Carregando histórico">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-xl" />
        ))}
      </div>
    );
  }
  if (isError) {
    return (
      <div role="alert" className="space-y-3 rounded-xl border p-5 text-sm">
        <p>Não foi possível carregar o histórico.</p>
        <Button variant="outline" className="h-11" onClick={() => refetch()}>
          Tentar de novo
        </Button>
      </div>
    );
  }
  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
        Nenhum treino finalizado ainda. Eles aparecem aqui assim que você salvar a primeira sessão.
      </div>
    );
  }

  return (
    <ul className="space-y-2" aria-label="Treinos finalizados">
      {data.map((workout) => {
        const summary = summarizeStored(workout);
        const name = workout.routine?.name ?? "Treino livre";
        return (
          <li key={workout.id}>
            <Link
              href={`/treino/historico/${workout.id}`}
              data-testid="history-item"
              className="group flex min-h-16 items-center gap-3 rounded-xl border bg-card px-4 py-3 outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{name}</span>
                <span className="block text-xs text-muted-foreground first-letter:uppercase">{formatDay(workout.day)}</span>
                <span className="num mt-1 block text-xs text-muted-foreground">
                  {formatDuration(summary.durationMin)} · {summary.sets} {summary.sets === 1 ? "série" : "séries"} ·{" "}
                  {formatKg(summary.volumeKg)} kg
                </span>
              </span>
              {summary.prs > 0 && (
                <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-highlight-text">
                  <Trophy aria-hidden className="size-4" />
                  <span className="num">{summary.prs}</span> {summary.prs === 1 ? "PR" : "PRs"}
                </span>
              )}
              <ChevronRight aria-hidden className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
