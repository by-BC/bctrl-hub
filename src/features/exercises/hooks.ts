"use client";

import { useCallback, useDeferredValue, useMemo, useState } from "react";
import type { Exercise } from "@/features/routines/api";
import { useExercises } from "@/features/routines/hooks";
import {
  catalogFacets,
  EMPTY_FILTERS,
  filterCatalog,
  visibleCount,
  type CatalogFilters,
} from "@/features/exercises/domain/catalog";

/**
 * Estado do catálogo (busca, chips e paginação no cliente), igual na tela
 * `/treino/exercicios` e no seletor de exercício. Os dados vêm da mesma query da v1
 * (`exerciseKeys.all`), então abrir o seletor depois do catálogo não refaz a leitura.
 */
export function useCatalogView() {
  const query = useExercises();
  const [filters, setFilters] = useState<CatalogFilters>(EMPTY_FILTERS);
  const [pages, setPages] = useState(1);
  // Digitar não espera o filtro de ~455 itens: a lista acompanha logo depois.
  const deferred = useDeferredValue(filters);

  const all = query.data;
  const facets = useMemo(() => catalogFacets(all ?? []), [all]);
  const results = useMemo(() => filterCatalog(all ?? [], deferred), [all, deferred]);
  const shown = results.slice(0, visibleCount(results.length, pages));
  const showMore = useCallback(() => setPages((p) => p + 1), []);

  return {
    ...query,
    filters,
    setFilters: (next: CatalogFilters) => {
      setFilters(next);
      setPages(1);
    },
    facets,
    results,
    shown,
    remaining: results.length - shown.length,
    showMore,
  };
}

/** Exercício do catálogo pelo id (lido do cache da biblioteca). */
export function useCatalogExercise(id: string | undefined): Exercise | undefined {
  const { data } = useExercises();
  return useMemo(() => (id ? data?.find((e) => e.id === id) : undefined), [data, id]);
}
