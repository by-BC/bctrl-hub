"use client";

import { ChevronRight, Search } from "lucide-react";
import Link from "next/link";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { filterExercises } from "@/lib/domain/routines";
import { formatDistance, formatKg, formatSeconds, formatShortDay } from "@/lib/format";
import type { ProgressOverviewItem } from "../api";
import { useProgressOverview } from "../hooks";

/** Treinados primeiro (mais recente no topo); os sem treino no fim, em ordem alfabética. */
function byRecency(a: ProgressOverviewItem, b: ProgressOverviewItem) {
  if (a.lastDay && b.lastDay) return b.lastDay.localeCompare(a.lastDay) || a.name.localeCompare(b.name, "pt-BR");
  if (a.lastDay) return -1;
  if (b.lastDay) return 1;
  return a.name.localeCompare(b.name, "pt-BR");
}

/** Lista de /evolucao: exercícios com último treino e melhor carga, com busca. */
export function ProgressList() {
  const searchId = useId();
  const { data, isPending, isError, refetch } = useProgressOverview();
  const [query, setQuery] = useState("");

  const results = filterExercises(data ?? [], query).sort(byRecency);

  return (
    <section aria-labelledby="exercicios-titulo" className="space-y-3">
      <h2 id="exercicios-titulo" className="text-lg font-semibold">
        Exercícios
      </h2>
      <div className="relative">
        <Search
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <label htmlFor={searchId} className="sr-only">
          Buscar exercício
        </label>
        <Input
          id={searchId}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por nome ou grupo"
          autoComplete="off"
          className="h-11 pl-9 text-base"
        />
      </div>

      {isPending ? (
        <div className="space-y-2" aria-busy="true" aria-label="Carregando exercícios">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : isError ? (
        <div role="alert" className="space-y-3 rounded-xl border p-5 text-sm">
          <p>Não foi possível carregar a evolução.</p>
          <Button variant="outline" className="h-11" onClick={() => refetch()}>
            Tentar de novo
          </Button>
        </div>
      ) : data.length === 0 ? (
        <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
          Nenhum exercício cadastrado ainda. Crie na biblioteca de exercícios do Treino.
        </div>
      ) : results.length === 0 ? (
        <p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground" role="status">
          Nenhum exercício encontrado para “{query.trim()}”.
        </p>
      ) : (
        <ul className="space-y-2" aria-label="Exercícios">
          {results.map((e) => (
            <li key={e.id}>
              <Link
                href={`/evolucao/${e.id}`}
                data-testid="progress-item"
                className="group flex min-h-16 items-center gap-3 rounded-xl border bg-card px-4 py-3 outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{e.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {e.lastDay ? (
                      <>
                        Último treino <span className="num">{formatShortDay(e.lastDay, { year: true })}</span>
                      </>
                    ) : (
                      "Sem treinos ainda"
                    )}
                    {e.muscle_group && <> · {e.muscle_group}</>}
                  </span>
                </span>
                {headline(e) && (
                  <span className="shrink-0 text-right">
                    <span className="num block font-semibold">{headline(e)!.value}</span>
                    <span className="block text-xs text-muted-foreground">{headline(e)!.label}</span>
                  </span>
                )}
                <ChevronRight
                  aria-hidden
                  className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Marca de destaque na lista: melhor carga; sem carga, maior distância ou maior duração. */
function headline(e: ProgressOverviewItem): { value: string; label: string } | null {
  if (e.maxWeight !== null) return { value: `${formatKg(e.maxWeight)} kg`, label: "melhor carga" };
  if (e.bests?.maxDistanceM != null) return { value: formatDistance(e.bests.maxDistanceM), label: "maior distância" };
  if (e.bests?.maxDurationS != null) return { value: formatSeconds(e.bests.maxDurationS), label: "maior duração" };
  return null;
}
