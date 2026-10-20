/**
 * TACO (Tabela Brasileira de Composição de Alimentos, 4ª ed., NEPA/Unicamp) para a tabela `foods`.
 * Fonte: TACO.json de github.com/marcelosanto/tabela_taco (licença MIT). Dado público: a migration
 * gerada é versionada. Puro (sem I/O): o script `convert.ts` lê o JSON e grava o arquivo.
 */

export const TACO_SOURCE_URL = "https://raw.githubusercontent.com/marcelosanto/tabela_taco/main/TACO.json";

/** Campos do TACO.json que usamos (por 100 g). Os demais são ignorados. */
export type TacoRaw = {
  id: number;
  description: string;
  category: string;
  energy_kcal: number | string;
  protein_g: number | string;
  lipid_g: number | string;
  carbohydrate_g: number | string;
};

/** Linha de `foods` (TACO): `user_id` nulo, valores por 100 g. */
export type TacoFood = {
  taco_id: number;
  name: string;
  category: string;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
};

/**
 * Valor numérico da TACO. "NA" (não aplicável), "Tr" (traço), "*" (em revisão) e vazio viram 0:
 * a coluna é `not null` e o app trata o alimento como "sem valor" pelo zero. Negativos (a TACO
 * calcula o carboidrato por diferença, ex.: -0,03 g) também viram 0, como pede o check da coluna.
 */
export function tacoNumber(value: number | string | null | undefined): number {
  const n = typeof value === "number" ? value : typeof value === "string" && value.trim() !== "" ? Number(value.replace(",", ".")) : NaN;
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : 0;
}

/** TACO.json → linhas de `foods`, ordenadas pelo id da TACO. Falha cedo se a estrutura mudar. */
export function tacoToFoods(raw: unknown): TacoFood[] {
  if (!Array.isArray(raw)) throw new Error("TACO.json: esperava um array.");
  const seen = new Set<number>();
  const foods = raw.map((r: TacoRaw, i) => {
    if (!Number.isInteger(r?.id) || typeof r.description !== "string" || !r.description.trim()) {
      throw new Error(`TACO.json: item ${i} sem id ou descrição.`);
    }
    if (seen.has(r.id)) throw new Error(`TACO.json: id ${r.id} repetido.`);
    seen.add(r.id);
    return {
      taco_id: r.id,
      name: r.description.trim().replace(/\s+/g, " "),
      category: String(r.category ?? "").trim(),
      kcal: tacoNumber(r.energy_kcal),
      protein_g: tacoNumber(r.protein_g),
      carbs_g: tacoNumber(r.carbohydrate_g),
      fat_g: tacoNumber(r.lipid_g),
    };
  });
  return foods.sort((a, b) => a.taco_id - b.taco_id);
}

const q = (s: string) => `'${s.replace(/'/g, "''")}'`;
const n = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(2).replace(/0+$/, ""));

/**
 * Migration idempotente: id determinístico (`md5('taco:' || taco_id)`), igual em qualquer banco,
 * e `on conflict (taco_id) do update` (reaplicar atualiza os valores sem duplicar).
 */
export function buildTacoMigration(foods: readonly TacoFood[]): string {
  const values = foods.map(
    (f) => `  (${f.taco_id}, ${q(f.name)}, ${q(f.category)}, ${n(f.kcal)}, ${n(f.protein_g)}, ${n(f.carbs_g)}, ${n(f.fat_g)})`,
  );
  return [
    "-- TACO (Tabela Brasileira de Composição de Alimentos), 4ª ed. — NEPA/Unicamp.",
    `-- Fonte: ${TACO_SOURCE_URL} (licença MIT).`,
    "-- Gerado por scripts/taco/convert.ts. Não editar à mão: rode o script de novo.",
    "-- Valores por 100 g. \"NA\", \"Tr\" (traço) e \"*\" (em revisão) viraram 0.",
    `-- ${foods.length} alimentos, com user_id nulo (dado público de referência, ver RLS de foods).`,
    "",
    "insert into public.foods (id, user_id, taco_id, name, category, kcal, protein_g, carbs_g, fat_g)",
    "select md5('taco:' || v.taco_id)::uuid, null, v.taco_id, v.name, v.category, v.kcal, v.protein_g, v.carbs_g, v.fat_g",
    "from (values",
    values.join(",\n"),
    ") as v (taco_id, name, category, kcal, protein_g, carbs_g, fat_g)",
    "on conflict (taco_id) do update set",
    "  name = excluded.name,",
    "  category = excluded.category,",
    "  kcal = excluded.kcal,",
    "  protein_g = excluded.protein_g,",
    "  carbs_g = excluded.carbs_g,",
    "  fat_g = excluded.fat_g;",
    "",
  ].join("\n");
}

const SQL_STR = "'((?:[^']|'')*)'";
const NUM = "(\\d+(?:\\.\\d+)?)";

/** Lê de volta as linhas da migration (fonte da TACO para o auto-vínculo do plano). */
export function parseTacoMigration(sql: string): TacoFood[] {
  const re = new RegExp(`^\\s*\\((\\d+), ${SQL_STR}, ${SQL_STR}, ${NUM}, ${NUM}, ${NUM}, ${NUM}\\)`, "gm");
  const un = (s: string) => s.replace(/''/g, "'");
  return [...sql.matchAll(re)].map((m) => ({
    taco_id: Number(m[1]),
    name: un(m[2]),
    category: un(m[3]),
    kcal: Number(m[4]),
    protein_g: Number(m[5]),
    carbs_g: Number(m[6]),
    fat_g: Number(m[7]),
  }));
}

/** Id do alimento TACO no banco (o mesmo da migration). */
export const tacoFoodIdSql = (tacoId: number) => `md5('taco:' || ${tacoId})::uuid`;
