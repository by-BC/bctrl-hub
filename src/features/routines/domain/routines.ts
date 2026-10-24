import { normalizeText } from "@/lib/domain/text";

export { normalizeText as normalizeExerciseName } from "@/lib/domain/text";

/**
 * Regras puras de rotinas e exercícios (sem I/O).
 * `position` começa em 1 e não tem buracos depois de qualquer operação.
 */

export type Positioned = { id: string; position: number };

/** Ordena por `position` (empate pelo id, para ser determinístico) e renumera 1..n. */
export function normalizePositions<T extends Positioned>(items: readonly T[]): T[] {
  return [...items]
    .sort((a, b) => a.position - b.position || a.id.localeCompare(b.id))
    .map((item, index) => (item.position === index + 1 ? item : { ...item, position: index + 1 }));
}

/**
 * Move o item de `from` para `to` (índices na ordem atual) e devolve a lista renumerada.
 * Índices fora da lista são limitados às pontas; sem mudança, devolve a ordem normalizada.
 */
export function reorder<T extends Positioned>(items: readonly T[], from: number, to: number): T[] {
  const sorted = normalizePositions(items);
  if (sorted.length === 0) return sorted;
  const clamp = (i: number) => Math.min(Math.max(i, 0), sorted.length - 1);
  const [fromIndex, toIndex] = [clamp(from), clamp(to)];
  const [moved] = sorted.splice(fromIndex, 1);
  sorted.splice(toIndex, 0, moved);
  return sorted.map((item, index) => (item.position === index + 1 ? item : { ...item, position: index + 1 }));
}

/** Move o item `id` uma casa para cima (-1) ou para baixo (+1). */
export function moveById<T extends Positioned>(items: readonly T[], id: string, direction: -1 | 1): T[] {
  const sorted = normalizePositions(items);
  const from = sorted.findIndex((item) => item.id === id);
  if (from === -1) return sorted;
  return reorder(sorted, from, from + direction);
}

/** Remove o item `id` e fecha o buraco. */
export function removeById<T extends Positioned>(items: readonly T[], id: string): T[] {
  return normalizePositions(items.filter((item) => item.id !== id));
}

/** Posição para um item novo no fim da lista. */
export function nextPosition(items: readonly Positioned[]): number {
  return items.reduce((max, item) => Math.max(max, item.position), 0) + 1;
}

/** Só os itens cuja `position` mudou: é o que precisa ir ao banco. */
export function changedPositions<T extends Positioned>(before: readonly T[], after: readonly T[]): T[] {
  const old = new Map(before.map((item) => [item.id, item.position]));
  return after.filter((item) => old.get(item.id) !== item.position);
}

/** Totais mostrados no card da rotina. */
export function routineTotals(items: readonly { sets: number }[]): { exercises: number; sets: number } {
  return { exercises: items.length, sets: items.reduce((sum, item) => sum + item.sets, 0) };
}

/** Exercício já existente com o mesmo nome (ignorando `exceptId`, usado na edição). */
export function findDuplicateExercise<T extends { id: string; name: string }>(
  name: string,
  exercises: readonly T[],
  exceptId?: string,
): T | undefined {
  const target = normalizeText(name);
  if (!target) return undefined;
  return exercises.find((e) => e.id !== exceptId && normalizeText(e.name) === target);
}

/** Filtro da busca de exercícios: todas as palavras precisam aparecer no nome ou no grupo. */
export function filterExercises<T extends { name: string; muscle_group: string | null }>(
  exercises: readonly T[],
  query: string,
): T[] {
  const words = normalizeText(query).split(" ").filter(Boolean);
  const sorted = [...exercises].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  if (words.length === 0) return sorted;
  return sorted.filter((e) => {
    const haystack = normalizeText(`${e.name} ${e.muscle_group ?? ""}`);
    return words.every((w) => haystack.includes(w));
  });
}

/** Descanso em `m:ss` (ex.: 90 → "1:30"). */
export function formatRest(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
