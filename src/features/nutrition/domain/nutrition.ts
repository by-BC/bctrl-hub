/**
 * Nutrição (v2): kcal e macros de item, opção do plano e busca de alimentos. Sem I/O.
 *
 * Valores dos alimentos (`foods`, TACO ou próprios) são por 100 g. Um item do plano vale
 * `alimento × gramas / 100`, a menos que tenha `macros_override` (valores do item inteiro,
 * digitados pelo dono). Itens "à vontade" (`free`) valem 0 e não contam como sem valor.
 */

import { normalizeText } from "@/lib/domain/text";
import { dayToTime } from "@/lib/domain/stats";
import { selectedMealItems } from "@/features/meals/domain/meals";

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

// ── Total do dia e consumido × meta ───────────────────────────────────────

/** Total do dia: opções marcadas + itens fora do plano (snapshot gravado em `meal_log_items`). */
export function dayTotals(input: { options: readonly Macros[]; offPlan: readonly Macros[] }): Macros {
  return [...input.options, ...input.offPlan].reduce(addMacros, { ...ZERO_MACROS });
}

/** Item fora do plano como vem do banco (valores do item inteiro, não por 100 g). */
export type OffPlanSnapshot = { kcal: number; protein_g: number; carbs_g: number; fat_g: number };

export const snapshotMacros = (s: OffPlanSnapshot): Macros => ({
  kcal: Number(s.kcal),
  protein: Number(s.protein_g),
  carbs: Number(s.carbs_g),
  fat: Number(s.fat_g),
});

/**
 * Snapshot de um alimento numa quantidade: valores do item inteiro, arredondados como as
 * colunas de `meal_log_items` (1 casa). É o que fica gravado: editar o alimento depois não muda o dia.
 */
export function foodSnapshot(food: Food, grams: number): OffPlanSnapshot {
  const m = itemMacros(food, grams)!;
  const r1 = (n: number) => Math.round(n * 10) / 10;
  return { kcal: r1(m.kcal), protein_g: r1(m.protein), carbs_g: r1(m.carbs), fat_g: r1(m.fat) };
}

export type MacroProgress = {
  key: MacroKey;
  consumed: number;
  goal: number;
  /** consumido / meta (0 quando a meta é 0). Pode passar de 1. */
  ratio: number;
  /** meta − consumido, quando falta; 0 se já chegou. */
  remaining: number;
  /** consumido − meta, quando passou; 0 se não passou. */
  excess: number;
};

/**
 * Consumido × meta por macro, com os valores arredondados para exibir (kcal inteiro, g com 1
 * casa) antes de comparar: assim "faltam" e "excedeu" batem com os números da tela.
 */
export function macroProgress(consumed: Macros, goal: Macros): MacroProgress[] {
  const c = roundMacros(consumed);
  const g = roundMacros(goal);
  const r1 = (n: number) => Math.round(n * 10) / 10;
  return MACRO_KEYS.map((key) => {
    const diff = r1(g[key] - c[key]);
    return {
      key,
      consumed: c[key],
      goal: g[key],
      ratio: g[key] > 0 ? c[key] / g[key] : 0,
      remaining: diff > 0 ? diff : 0,
      excess: diff < 0 ? -diff : 0,
    };
  });
}

// ── Metas a partir do perfil ──────────────────────────────────────────────

export const SEXES = ["m", "f"] as const;
export type Sex = (typeof SEXES)[number];
export const ACTIVITY_LEVELS = ["sedentary", "light", "moderate", "active", "very_active"] as const;
export type ActivityLevel = (typeof ACTIVITY_LEVELS)[number];
export const GOALS = ["lose", "maintain", "gain"] as const;
export type Goal = (typeof GOALS)[number];

/** Fator de atividade (gasto diário = TMB × fator). */
export const ACTIVITY_FACTOR: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

/** Ajuste das kcal pelo objetivo: −20% para perder, 0 para manter, +10% para ganhar. */
export const GOAL_ADJUST: Record<Goal, number> = { lose: -0.2, maintain: 0, gain: 0.1 };

/** Gordura: 0,8 g por kg, com piso de 20% das kcal. */
export const FAT_G_PER_KG = 0.8;
export const FAT_MIN_SHARE = 0.2;
/** Dia de treino: +10% de carboidrato (e as kcal acompanham), sem override. */
export const TRAINING_CARBS_BONUS = 0.1;

export const KCAL_PER_G = { protein: 4, carbs: 4, fat: 9 } as const;

/** Fonte da TMB escolhida no perfil: `auto` (balança se recente, senão fórmula), `scale` ou `formula`. */
export const BMR_SOURCES = ["auto", "scale", "formula"] as const;
export type BmrSourceSetting = (typeof BMR_SOURCES)[number];
/** Base da proteína-alvo: peso total ou massa magra da última medição. */
export const PROTEIN_BASES = ["weight", "lean_mass"] as const;
export type ProteinBasis = (typeof PROTEIN_BASES)[number];
/** No modo `auto`, a TMB da balança vale por até 30 dias. */
export const BMR_MAX_AGE_DAYS = 30;
export const PROTEIN_G_PER_KG_LEAN_DEFAULT = 2.5;

/**
 * O que vem das medições da balança: a TMB da última medição que tem `bmr_kcal` (com o dia) e
 * a massa magra da última que tem `lean_mass_kg`. Tudo opcional: sem medição, nada muda.
 */
export type BmrInput = { measuredKcal?: number; measuredOn?: string; leanMassKg?: number };

/** Ajuste manual por macro: `rest` vale no dia sem treino (e de base no de treino), `training` no de treino. */
export type GoalOverrides = { rest?: Partial<Macros> | null; training?: Partial<Macros> | null };

export type NutritionProfile = {
  sex: Sex | null;
  birth_date: string | null;
  height_cm: number | null;
  activity_level: ActivityLevel | null;
  goal: Goal | null;
  protein_g_per_kg: number;
  goal_overrides?: GoalOverrides | null;
  /** v3: fonte da TMB (padrão `auto`). */
  bmr_source?: BmrSourceSetting | null;
  /** v3: base da proteína-alvo (padrão `weight`). */
  protein_basis?: ProteinBasis | null;
  /** v3: g de proteína por kg de massa magra (padrão 2,5). */
  protein_g_per_kg_lean?: number | null;
};

/** Os campos que o cálculo exige estão preenchidos. */
export type CompleteProfile = NutritionProfile & {
  sex: Sex;
  birth_date: string;
  height_cm: number;
  activity_level: ActivityLevel;
  goal: Goal;
};

export const isCompleteProfile = (p: NutritionProfile | null | undefined): p is CompleteProfile =>
  !!p && !!p.sex && !!p.birth_date && typeof p.height_cm === "number" && p.height_cm > 0 && !!p.activity_level && !!p.goal;

/** Idade em anos completos no dia `onDay` (AAAA-MM-DD). */
export function ageOn(birthDate: string, onDay: string): number {
  const [by, bm, bd] = birthDate.split("-").map(Number);
  const [y, m, d] = onDay.split("-").map(Number);
  return y - by - (m < bm || (m === bm && d < bd) ? 1 : 0);
}

/** Cada passo da conta, para mostrar no formulário. Valores sem arredondar. */
export type GoalBreakdown = {
  age: number;
  /** TMB usada: a da balança ou a da fórmula (Mifflin-St Jeor), ver `bmrSource`. */
  bmr: number;
  factor: number;
  /** Gasto diário = TMB × fator. */
  tdee: number;
  adjust: number;
  kcal: number;
  protein: number;
  /** Gordura por kg (0,8 g/kg) e o piso de 20% das kcal, em gramas. */
  fatPerKg: number;
  fatMin: number;
  fat: number;
  carbs: number;
  /** TMB usada: a da balança ou a da fórmula. */
  bmrSource: "scale" | "formula";
  /** Dia da medição, quando a TMB é a da balança. */
  bmrDate?: string;
  /** A fonte escolhida era `scale`, mas não há medição com TMB: caiu na fórmula. */
  bmrFallback: boolean;
  /** Base efetiva da proteína (`lean_mass` sem massa magra volta para `weight`). */
  proteinBasis: ProteinBasis;
};

const positive = (n: number | undefined): n is number => typeof n === "number" && Number.isFinite(n) && n > 0;

/** Dias de `from` a `to` (AAAA-MM-DD), pelo calendário. */
const daysBetween = (from: string, to: string) => Math.round((dayToTime(to) - dayToTime(from)) / 86_400_000);

/**
 * Por que a TMB é a que é (para o formulário explicar):
 * - `scale`: a da balança;
 * - `formula_chosen`: a fonte escolhida é a fórmula;
 * - `no_measurement`: `auto` sem medição com TMB;
 * - `stale`: `auto` com a última TMB medida há mais de 30 dias;
 * - `fallback`: a fonte escolhida é a balança, mas não há medição com TMB.
 */
export type BmrReason = "scale" | "formula_chosen" | "no_measurement" | "stale" | "fallback";

export type BmrChoice = { source: "scale" | "formula"; reason: BmrReason; date?: string };

/** Escolhe a fonte da TMB pela regra do perfil, sem fazer a conta (o formulário mostra o motivo). */
export function bmrChoice(setting: BmrSourceSetting, onDay: string, m: BmrInput | undefined): BmrChoice {
  const has = positive(m?.measuredKcal);
  const scale = (): BmrChoice => ({ source: "scale", reason: "scale", ...(m?.measuredOn && { date: m.measuredOn }) });
  if (setting === "formula") return { source: "formula", reason: "formula_chosen" };
  if (setting === "scale") return has ? scale() : { source: "formula", reason: "fallback" };
  if (!has || !m?.measuredOn) return { source: "formula", reason: "no_measurement" };
  return daysBetween(m.measuredOn, onDay) <= BMR_MAX_AGE_DAYS
    ? scale()
    : { source: "formula", reason: "stale", date: m.measuredOn };
}

/** Escolhe a TMB: balança (pela regra da fonte) ou Mifflin-St Jeor. */
function pickBmr(
  setting: BmrSourceSetting,
  formula: number,
  onDay: string,
  m: BmrInput | undefined,
): Pick<GoalBreakdown, "bmr" | "bmrSource" | "bmrDate" | "bmrFallback"> {
  const choice = bmrChoice(setting, onDay, m);
  if (choice.source === "formula") return { bmr: formula, bmrSource: "formula", bmrFallback: choice.reason === "fallback" };
  return { bmr: m!.measuredKcal!, bmrSource: "scale", bmrFallback: false, ...(choice.date && { bmrDate: choice.date }) };
}

/**
 * Metas calculadas (sem override) para o dia sem treino.
 * TMB: a da balança quando a fonte permite (`auto`: medição de até 30 dias; `scale`: qualquer
 * medição; `formula`: nunca); senão Mifflin-St Jeor:
 * TMB = 10·peso + 6,25·altura − 5·idade + 5 (m) ou − 161 (f); kcal = TMB × fator × (1 + ajuste);
 * proteína = g/kg × peso (ou g/kg de massa magra × massa magra, com base `lean_mass` e medição);
 * gordura = máx(0,8 g/kg, 20% das kcal ÷ 9); carboidrato = o restante ÷ 4.
 */
export function goalBreakdown(p: CompleteProfile, weightKg: number, onDay: string, m?: BmrInput): GoalBreakdown {
  const age = ageOn(p.birth_date, onDay);
  const formula = 10 * weightKg + 6.25 * Number(p.height_cm) - 5 * age + (p.sex === "m" ? 5 : -161);
  const source = pickBmr(p.bmr_source ?? "auto", formula, onDay, m);
  const bmr = source.bmr;
  const factor = ACTIVITY_FACTOR[p.activity_level];
  const tdee = bmr * factor;
  const adjust = GOAL_ADJUST[p.goal];
  const kcal = tdee * (1 + adjust);
  const leanKg = m?.leanMassKg;
  const lean = p.protein_basis === "lean_mass" && positive(leanKg) ? leanKg : null;
  const proteinBasis: ProteinBasis = lean === null ? "weight" : "lean_mass";
  const protein =
    lean === null ? Number(p.protein_g_per_kg) * weightKg : Number(p.protein_g_per_kg_lean ?? PROTEIN_G_PER_KG_LEAN_DEFAULT) * lean;
  const fatPerKg = FAT_G_PER_KG * weightKg;
  const fatMin = (FAT_MIN_SHARE * kcal) / KCAL_PER_G.fat;
  const fat = Math.max(fatPerKg, fatMin);
  const carbs = Math.max(0, (kcal - protein * KCAL_PER_G.protein - fat * KCAL_PER_G.fat) / KCAL_PER_G.carbs);
  return { age, ...source, factor, tdee, adjust, kcal, protein, fatPerKg, fatMin, fat, carbs, proteinBasis };
}

const pickOverride = (o: Partial<Macros> | null | undefined, k: MacroKey): number | null => {
  const v = o?.[k];
  return typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null;
};

/**
 * Metas do dia (kcal inteiro, macros em g inteiros).
 *
 * Dia sem treino: o cálculo, com cada macro do `goal_overrides.rest` substituindo o seu.
 * Dia de treino: cada macro do `goal_overrides.training` substitui o seu; sem ele, vale o do
 * dia sem treino, e o carboidrato ganha +10% (as kcal sobem 4 por grama a mais, se também não
 * tiverem override de treino).
 */
export function goalsFromProfile(
  p: CompleteProfile,
  weightKg: number,
  trainingDay: boolean,
  onDay: string,
  m?: BmrInput,
): Macros {
  const b = goalBreakdown(p, weightKg, onDay, m);
  const rest = p.goal_overrides?.rest;
  const base: Macros = {
    kcal: pickOverride(rest, "kcal") ?? b.kcal,
    protein: pickOverride(rest, "protein") ?? b.protein,
    carbs: pickOverride(rest, "carbs") ?? b.carbs,
    fat: pickOverride(rest, "fat") ?? b.fat,
  };
  if (!trainingDay) return roundGoals(base);

  const training = p.goal_overrides?.training;
  const carbs = pickOverride(training, "carbs") ?? base.carbs * (1 + TRAINING_CARBS_BONUS);
  return roundGoals({
    kcal: pickOverride(training, "kcal") ?? base.kcal + (carbs - base.carbs) * KCAL_PER_G.carbs,
    protein: pickOverride(training, "protein") ?? base.protein,
    carbs,
    fat: pickOverride(training, "fat") ?? base.fat,
  });
}

const roundGoals = (m: Macros): Macros => ({
  kcal: Math.round(m.kcal),
  protein: Math.round(m.protein),
  carbs: Math.round(m.carbs),
  fat: Math.round(m.fat),
});

// ── Quantidade do item fora do plano ──────────────────────────────────────

export type AmountUnit = { key: string; label: string; grams: number };

/** Unidades de um alimento: g, ml (densidade ≈ 1) e as unidades com peso de referência. */
export function amountUnits(food: Pick<Food, "unit_grams">): AmountUnit[] {
  const extra = Object.entries(food.unit_grams ?? {})
    .filter(([, g]) => typeof g === "number" && Number.isFinite(g) && g > 0)
    .map(([key, g]) => ({ key, label: key, grams: g }));
  return [{ key: "g", label: "g", grams: 1 }, { key: "ml", label: "ml", grams: 1 }, ...extra];
}

/** Gramas de uma quantidade numa unidade (1 casa, como `meal_log_items.grams`). `null` se inválida. */
export function amountToGrams(amount: number | null, unit: AmountUnit): number | null {
  if (amount === null || !Number.isFinite(amount) || amount <= 0) return null;
  const grams = Math.round(amount * unit.grams * 10) / 10;
  return grams > 0 && grams <= 99999 ? grams : null;
}

// ── Média do mês × meta ───────────────────────────────────────────────────

/** Parte `nutrition` do `month_summary`: o que foi marcado nos dias com registro do mês. */
export type MonthNutritionFacts = {
  /** Dias com algum registro de refeição prevista (dentro ou fora do plano). */
  logged_days: number;
  /** Quantos desses dias tiveram treino finalizado. */
  training_days: number;
  /** Quantas vezes cada opção do plano foi marcada. */
  options: readonly {
    option_id: string;
    count: number;
    /** Ausente/nulo = opção inteira (compatível com registros anteriores). */
    selected_item_indices?: readonly number[] | null;
  }[];
  /** Soma dos itens fora do plano (snapshot). */
  off_plan: Macros;
};

export type MonthNutrition = {
  /** Dias da média (os com registro). */
  days: number;
  /** Média consumida por dia registrado; `null` sem dias. */
  consumed: Macros | null;
  /** Meta média dos mesmos dias (treino e descanso na proporção do mês); `null` sem meta ou sem dias. */
  goal: Macros | null;
  /** Itens sem valor (e opções que saíram do plano) que ficaram fora da média, contando repetições. */
  unresolved: number;
};

const scaleMacros = (m: Macros, k: number): Macros => ({
  kcal: m.kcal * k,
  protein: m.protein * k,
  carbs: m.carbs * k,
  fat: m.fat * k,
});

/**
 * kcal e macros médios do mês × meta. As opções valem os macros de hoje do plano (`optionItems`
 * por id da opção, com `optionMacros`); o fora do plano já vem somado do banco. A meta de cada
 * dia é a de descanso ou a de treino (`goalsFromProfile`), ponderada pelos dias de treino.
 */
export function monthNutrition(
  facts: MonthNutritionFacts,
  optionItems: ReadonlyMap<string, readonly PlanItem[]>,
  foods: ReadonlyMap<string, Food>,
  goals: { rest: Macros; training: Macros } | null,
): MonthNutrition {
  let total: Macros = { ...facts.off_plan };
  let unresolved = 0;
  for (const { option_id, count, selected_item_indices } of facts.options) {
    const items = optionItems.get(option_id);
    if (!items) {
      unresolved += count;
      continue;
    }
    const m = optionMacros(selectedMealItems(items, selected_item_indices), foods);
    total = addMacros(total, scaleMacros(m.total, count));
    unresolved += m.unresolved * count;
  }

  const days = facts.logged_days;
  if (days <= 0) return { days: 0, consumed: null, goal: null, unresolved };
  const training = Math.min(days, Math.max(0, facts.training_days));
  const goal = goals
    ? scaleMacros(addMacros(scaleMacros(goals.rest, days - training), scaleMacros(goals.training, training)), 1 / days)
    : null;
  return { days, consumed: scaleMacros(total, 1 / days), goal, unresolved };
}
