/**
 * Catálogo de exercícios: busca sem acento, filtros por músculo principal e equipamento
 * e ordenação. Sem I/O: a tela, o seletor e os testes usam as mesmas regras.
 *
 * Regras dos filtros:
 * - dentro de um grupo (ex.: músculos), os chips marcados somam ("Peito" ou "Costas");
 * - entre grupos, todos precisam bater ("Peito" e "Halter");
 * - a busca exige todas as palavras no nome, no músculo ou no equipamento.
 */

import { normalizeExerciseName } from "./routines";

export type CatalogItem = {
  id: string;
  name: string;
  muscle_group: string | null;
  equipment?: string | null;
};

export type CatalogFilters = {
  query: string;
  muscles: readonly string[];
  equipment: readonly string[];
};

export const EMPTY_FILTERS: CatalogFilters = { query: "", muscles: [], equipment: [] };

export type FacetOption = { value: string; label: string; count: number };

/** Texto comparável: sem acento, sem diferença de caixa e espaços repetidos. */
export const normalizeText = normalizeExerciseName;

/** Rótulo do equipamento no chip ("Nenhum" vira "Sem equipamento"). */
export function equipmentLabel(value: string): string {
  return value === "Nenhum" ? "Sem equipamento" : value;
}

export function hasActiveFilters(filters: CatalogFilters): boolean {
  return filters.query.trim() !== "" || filters.muscles.length > 0 || filters.equipment.length > 0;
}

/** Liga ou desliga um valor num grupo de chips. */
export function toggleValue(values: readonly string[], value: string): string[] {
  return values.includes(value) ? values.filter((v) => v !== value) : [...values, value];
}

/**
 * Relevância do nome para a busca (menor = melhor):
 * 0 nome começa com a busca · 1 alguma palavra do nome começa com a primeira palavra · 2 só contém.
 */
function rank(name: string, words: readonly string[]): number {
  const n = normalizeText(name);
  if (n.startsWith(words.join(" "))) return 0;
  if (n.split(/[\s()\-/]+/).some((part) => part.startsWith(words[0]))) return 1;
  return 2;
}

const byName = (a: CatalogItem, b: CatalogItem) => a.name.localeCompare(b.name, "pt-BR");

/** Aplica busca e filtros e ordena: por relevância quando há busca, senão alfabética. */
export function filterCatalog<T extends CatalogItem>(items: readonly T[], filters: CatalogFilters): T[] {
  const words = normalizeText(filters.query).split(" ").filter(Boolean);
  const muscles = new Set(filters.muscles);
  const equipment = new Set(filters.equipment);

  const result = items.filter((item) => {
    if (muscles.size > 0 && (!item.muscle_group || !muscles.has(item.muscle_group))) return false;
    if (equipment.size > 0 && (!item.equipment || !equipment.has(item.equipment))) return false;
    if (words.length === 0) return true;
    const haystack = normalizeText(
      [item.name, item.muscle_group, item.equipment && equipmentLabel(item.equipment)].filter(Boolean).join(" "),
    );
    return words.every((w) => haystack.includes(w));
  });

  if (words.length === 0) return result.sort(byName);
  const ranks = new Map(result.map((item) => [item.id, rank(item.name, words)]));
  return result.sort((a, b) => ranks.get(a.id)! - ranks.get(b.id)! || byName(a, b));
}

function facet(values: readonly (string | null | undefined)[], label: (v: string) => string): FacetOption[] {
  const counts = new Map<string, number>();
  for (const v of values) if (v) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts]
    .map(([value, count]) => ({ value, label: label(value), count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "pt-BR"));
}

/** Chips disponíveis (com quantidade no catálogo inteiro), do mais comum ao mais raro. */
export function catalogFacets(items: readonly CatalogItem[]): { muscles: FacetOption[]; equipment: FacetOption[] } {
  return {
    muscles: facet(
      items.map((i) => i.muscle_group),
      (v) => v,
    ),
    equipment: facet(
      items.map((i) => i.equipment),
      equipmentLabel,
    ),
  };
}

/** Paginação no cliente: quantos itens mostrar depois de `pages` cliques em "Mostrar mais". */
export const CATALOG_PAGE_SIZE = 40;

export function visibleCount(total: number, pages: number, pageSize = CATALOG_PAGE_SIZE): number {
  return Math.min(total, Math.max(1, pages) * pageSize);
}
