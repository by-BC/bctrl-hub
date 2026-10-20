/**
 * Nutrição (v2): kcal e macros de item, opção do plano e busca de alimentos. Sem I/O.
 *
 * Valores dos alimentos (`foods`, TACO ou próprios) são por 100 g. Um item do plano vale
 * `alimento × gramas / 100`, a menos que tenha `macros_override` (valores do item inteiro,
 * digitados pelo dono). Itens "à vontade" (`free`) valem 0 e não contam como sem valor.
 */

import { normalizeExerciseName as normalizeText } from "./routines";

export type Macros = { kcal: number; protein: number; carbs: number; fat: number };

export const ZERO_MACROS: Macros = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
export const MACRO_KEYS = ["kcal", "protein", "carbs", "fat"] as const;
export type MacroKey = (typeof MACRO_KEYS)[number];

/** Alimento como vem de `foods` (por 100 g). `unit_grams`: peso por unidade, ex.: { un: 50 }. */
export type Food = {
  id: string;
  name: string;
  category?: string | null;
  taco_id?: number | null;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  unit_grams?: Record<string, number> | null;
};

/** Item de uma opção do plano (`meal_options.items`), só com os campos que entram no cálculo. */
export type PlanItem = {
  name: string;
  qty: string;
  food_id?: string | null;
  grams?: number | null;
  macros_override?: Partial<Macros> | null;
  free?: boolean | null;
};

// ── Quantidade ────────────────────────────────────────────────────────────

export type ParsedQty = {
  /** Gramas (ml contam como g: densidade ≈ 1). Nulo quando a quantidade não diz o peso. */
  grams: number | null;
  /** "à vontade": vale 0 kcal. */
  free: boolean;
  /** "2 un", "3 fatias": contagem para converter com o peso por unidade do alimento. */
  units: { count: number; unit: string } | null;
};

const NUMBER = "(\\d+(?:[.,]\\d+)?)";
const MASS = "(kg|g|gr|grama|gramas|ml|l|litro|litros)";
const toNumber = (s: string) => Number(s.replace(",", "."));
const toGrams = (n: number, unit: string) => (unit === "kg" || unit.startsWith("l") ? n * 1000 : n);

/** Chave do peso por unidade: "unidades"/"unid" → "un", "fatias" → "fatia", "colheres" → "colher". */
function unitKey(word: string): string {
  if (/^un(id|idade|idades)?$/.test(word)) return "un";
  if (/[rz]es$/.test(word)) return word.slice(0, -2);
  return word.replace(/s$/, "");
}

/**
 * Lê a quantidade escrita no plano.
 * "4 un (200 g)" → 200 · "1 fatia média (170 g)" → 170 · "5 ml (5g)" → 5 · "160g" → 160 ·
 * "à vontade" → livre · "2 un" → 2 unidades (peso vem do alimento).
 */
export function parseQty(qty: string): ParsedQty {
  const text = normalizeText(qty ?? "");
  if (/\ba vontade\b/.test(text)) return { grams: 0, free: true, units: null };

  // O peso entre parênteses tem prioridade: "3 fatias (75 g)".
  const paren = new RegExp(`\\(\\s*${NUMBER}\\s*${MASS}\\s*\\)`).exec(text);
  if (paren) return { grams: toGrams(toNumber(paren[1]), paren[2]), free: false, units: null };

  const whole = new RegExp(`^${NUMBER}\\s*${MASS}$`).exec(text);
  if (whole) return { grams: toGrams(toNumber(whole[1]), whole[2]), free: false, units: null };

  const count = new RegExp(`^${NUMBER}\\s*([a-z]+)`).exec(text);
  if (count) return { grams: null, free: false, units: { count: toNumber(count[1]), unit: unitKey(count[2]) } };

  return { grams: null, free: false, units: null };
}

/** Gramas do item: as gravadas; senão as da quantidade; senão unidades × peso por unidade do alimento. */
export function itemGrams(item: Pick<PlanItem, "qty" | "grams">, food: Pick<Food, "unit_grams"> | null): number | null {
  if (typeof item.grams === "number" && Number.isFinite(item.grams) && item.grams >= 0) return item.grams;
  const parsed = parseQty(item.qty);
  if (parsed.grams !== null) return parsed.grams;
  const perUnit = parsed.units && food?.unit_grams?.[parsed.units.unit];
  return parsed.units && typeof perUnit === "number" && perUnit > 0 ? parsed.units.count * perUnit : null;
}

/** O item é "à vontade"? A marca gravada vale; sem ela, a quantidade decide. */
export const isFreeItem = (item: Pick<PlanItem, "qty" | "free">) =>
  typeof item.free === "boolean" ? item.free : parseQty(item.qty).free;

// ── Macros ────────────────────────────────────────────────────────────────

const isComplete = (o: Partial<Macros> | null | undefined): o is Macros =>
  !!o && MACRO_KEYS.every((k) => typeof o[k] === "number" && Number.isFinite(o[k]));

/**
 * Macros de um item. Com alimento e gramas: proporcional aos 100 g, e os campos do
 * `override` substituem os calculados. Sem alimento ou sem gramas, só um override completo
 * dá valor; senão `null` (item sem valor).
 */
export function itemMacros(food: Food | null, grams: number | null, override?: Partial<Macros> | null): Macros | null {
  if (!food || grams === null) return isComplete(override) ? { ...override } : null;
  const f = grams / 100;
  const base: Macros = { kcal: food.kcal * f, protein: food.protein_g * f, carbs: food.carbs_g * f, fat: food.fat_g * f };
  if (!override) return base;
  const out = { ...base };
  for (const k of MACRO_KEYS) {
    const v = override[k];
    if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
  }
  return out;
}

export const addMacros = (a: Macros, b: Macros): Macros => ({
  kcal: a.kcal + b.kcal,
  protein: a.protein + b.protein,
  carbs: a.carbs + b.carbs,
  fat: a.fat + b.fat,
});

/** Valor de um item do plano, resolvendo o alimento pelo `food_id`. Livre = 0. */
export function planItemMacros(item: PlanItem, foods: ReadonlyMap<string, Food>): Macros | null {
  if (isFreeItem(item)) return { ...ZERO_MACROS };
  const food = item.food_id ? (foods.get(item.food_id) ?? null) : null;
  return itemMacros(food, itemGrams(item, food), item.macros_override);
}

/** Total da opção e quantos itens ficaram sem valor (sem alimento, sem gramas e sem override). */
export function optionMacros(
  items: readonly PlanItem[],
  foods: ReadonlyMap<string, Food>,
): { total: Macros; unresolved: number } {
  let total = { ...ZERO_MACROS };
  let unresolved = 0;
  for (const item of items) {
    const m = planItemMacros(item, foods);
    if (m) total = addMacros(total, m);
    else unresolved++;
  }
  return { total, unresolved };
}

/** Arredonda para exibir: kcal inteiro, macros com 1 casa. */
export function roundMacros(m: Macros): Macros {
  const r1 = (n: number) => Math.round(n * 10) / 10;
  return { kcal: Math.round(m.kcal), protein: r1(m.protein), carbs: r1(m.carbs), fat: r1(m.fat) };
}

// ── Busca de alimentos ────────────────────────────────────────────────────

export { normalizeText as normalizeFoodName };

/**
 * Busca sem acento e sem caixa: todas as palavras precisam estar no nome. Ordem: nome que
 * começa com a busca, depois com a primeira palavra, depois o resto; empate pelo nome mais curto.
 */
export function searchFoods<T extends Pick<Food, "name">>(foods: readonly T[], query: string, limit = 40): T[] {
  const words = normalizeText(query).split(/[\s,]+/).filter(Boolean);
  if (words.length === 0) return [];
  const scored: { food: T; rank: number; len: number }[] = [];
  for (const food of foods) {
    const name = normalizeText(food.name);
    if (!words.every((w) => name.includes(w))) continue;
    const rank = name.startsWith(words.join(" ")) ? 0 : name.split(/[\s,()/-]+/).some((p) => p.startsWith(words[0])) ? 1 : 2;
    scored.push({ food, rank, len: name.length });
  }
  return scored
    .sort((a, b) => a.rank - b.rank || a.len - b.len || a.food.name.localeCompare(b.food.name, "pt-BR"))
    .slice(0, limit)
    .map((s) => s.food);
}
