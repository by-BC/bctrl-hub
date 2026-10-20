/**
 * Auto-vínculo dos itens do plano alimentar com a TACO (task 4.0 v2). Puro: sem I/O.
 *
 * Ordem de decisão por item:
 *  1. quantidade "à vontade" → livre (0 kcal);
 *  2. override do dono (`scripts/meals/data/overrides.json`, fora do Git) pelo nome normalizado;
 *  3. sinônimos genéricos (abaixo) pelo nome inteiro e, depois, pela primeira parte
 *     ("Peixe assado/cozido" → "peixe assado"; "Batata ou inhame" → "batata");
 *  4. nome idêntico ao da TACO (sem acento, caixa e pontuação);
 *  5. senão, pendente, com sugestões da TACO por palavras em comum.
 * Alimento da TACO sem valores ("*" = em revisão, viraram 0) também fica pendente.
 */

import { normalizeFoodName, parseQty } from "../../src/lib/domain/nutrition";
import type { TacoFood } from "../taco/taco";

// ── Sinônimos genéricos (alimentos comuns → id da TACO) ──────────────────
// Chaves já normalizadas (sem acento, minúsculas, hífen vira espaço). `note` marca
// aproximações que o dono deve conferir. "free" = sem calorias (ex.: água).

type Synonym = { taco: number; note?: string } | "free" | { pending: string; suggest?: number[] };

const APROX_PAO_FORMA = "aproximação: a TACO não tem pão de forma tradicional (usa o integral)";
const SUPLEMENTO = "suplemento sem TACO: cadastre como alimento próprio ou ajuste os valores";

export const SYNONYMS: Record<string, Synonym> = {
  agua: "free",
  "agua mineral": "free",
  cafe: { taco: 471 },
  "cafe sem acucar": { taco: 471 },
  // Cereais
  arroz: { taco: 3 },
  "arroz branco": { taco: 3 },
  "arroz branco cozido": { taco: 3 },
  "arroz cozido": { taco: 3 },
  "arroz integral": { taco: 1 },
  "arroz integral cozido": { taco: 1 },
  aveia: { taco: 7 },
  "aveia em flocos": { taco: 7 },
  "pao de forma": { taco: 52, note: APROX_PAO_FORMA },
  "pao de forma integral": { taco: 52 },
  "pao integral": { taco: 52 },
  "pao frances": { taco: 53 },
  cuscuz: { taco: 533 },
  tapioca: { pending: "a TACO só tem tapioca com manteiga; goma pronta ≈ polvilho doce", suggest: [146, 551] },
  "macarrao cozido": {
    pending: "a TACO só tem macarrão cru: use o cru com o peso seco ou ajuste os valores",
    suggest: [40],
  },
  // Leguminosas
  feijao: { taco: 561 },
  "feijao cozido": { taco: 561 },
  "feijao carioca": { taco: 561 },
  "feijao preto": { taco: 567 },
  // Carnes, ovos e peixes
  frango: { taco: 410 },
  "frango grelhado": { taco: 410 },
  "file de frango": { taco: 410 },
  "file de frango grelhado": { taco: 410 },
  "peito de frango": { taco: 410 },
  "peito de frango grelhado": { taco: 410 },
  "frango desfiado": { taco: 408 },
  "peito de frango desfiado": { taco: 408 },
  "frango cozido": { taco: 408 },
  ovo: { taco: 488 },
  ovos: { taco: 488 },
  "ovo cozido": { taco: 488 },
  "ovo frito": { taco: 490 },
  "clara de ovo": { taco: 486 },
  patinho: { taco: 377 },
  "patinho grelhado": { taco: 377 },
  "carne moida": { taco: 326 },
  "carne vermelha magra": { taco: 377, note: "aproximação: patinho grelhado" },
  "carne suina magra": { taco: 432, note: "aproximação: lombo de porco assado" },
  "lombo de porco": { taco: 432 },
  sardinha: { taco: 318 },
  salmao: { taco: 317 },
  // Leite e derivados
  "leite integral": { taco: 458 },
  "leite desnatado": { taco: 457 },
  "iogurte natural": { taco: 448 },
  "iogurte desnatado": { taco: 449 },
  "iogurte natural desnatado": { taco: 449 },
  "queijo mucarela": { taco: 463 },
  "queijo mussarela": { taco: 463 },
  "queijo mozarela": { taco: 463 },
  mucarela: { taco: 463 },
  mussarela: { taco: 463 },
  "queijo minas frescal": { taco: 461 },
  "queijo minas": { taco: 461 },
  "queijo prato": { taco: 467 },
  ricota: { taco: 469 },
  "queijo ricota": { taco: 469 },
  "creme de leite": { taco: 447 },
  // Frutas
  banana: { taco: 182 },
  "banana prata": { taco: 182 },
  "banana nanica": { taco: 179 },
  mamao: { taco: 226 },
  "mamao papaia": { taco: 226 },
  "mamao formosa": { taco: 225 },
  maca: { taco: 222 },
  uva: { taco: 256 },
  morango: { taco: 239 },
  abacaxi: { taco: 164 },
  pera: { taco: 243 },
  melancia: { taco: 235 },
  melao: { taco: 236 },
  laranja: { taco: 214 },
  abacate: { taco: 163 },
  manga: { taco: 231 },
  // Hortaliças e tubérculos
  "batata inglesa": { taco: 91 },
  "batata inglesa cozida": { taco: 91 },
  "batata cozida": { taco: 91 },
  "batata doce": { taco: 88 },
  "batata doce cozida": { taco: 88 },
  "abobora cabotia": { taco: 64 },
  "abobora cabotian": { taco: 64 },
  brocolis: { taco: 100 },
  cenoura: { taco: 109 },
  tomate: { taco: 157 },
  // Gorduras, açúcares e outros
  azeite: { taco: 260 },
  "azeite de oliva": { taco: 260 },
  manteiga: { taco: 261 },
  mel: { taco: 507 },
  "doce de leite": { taco: 501 },
  "acucar": { taco: 494 },
  "pasta de amendoim": {
    pending: "a TACO não tem pasta de amendoim: amendoim torrado é uma aproximação",
    suggest: [558, 557],
  },
  // Suplementos (sem TACO)
  whey: { pending: SUPLEMENTO },
  "whey protein": { pending: SUPLEMENTO },
  creatina: { pending: SUPLEMENTO },
  glutamina: { pending: SUPLEMENTO },
};

/** Nome comparável: sem acento e caixa, hífen como espaço, sem pontuação nas pontas. */
export function normalizeItemName(name: string): string {
  return normalizeFoodName(name.replace(/-/g, " ")).replace(/[.;:]+$/g, "").trim();
}

/** Nome da TACO comparável ("Arroz, integral, cozido" → "arroz integral cozido"). */
const normalizeTaco = (name: string) => normalizeItemName(name.replace(/,/g, " "));

/** Nome inteiro e, depois, só a primeira alternativa ("A/B", "A ou B", "A e B"). */
export function nameCandidates(name: string): string[] {
  const full = normalizeItemName(name);
  const first = full.split(/\s*\/\s*|\s+ou\s+|\s+e\s+/)[0]?.trim() ?? "";
  // Sem qualificativos de marca/dieta: "iogurte grego light" → "iogurte grego".
  const plain = first.replace(/\b(light|zero|diet)\b|\b100%/g, "").replace(/\s+/g, " ").trim();
  return [...new Set([full, first, plain].filter(Boolean))];
}

/**
 * Decisão do dono por nome de item: id da TACO, "free", "pending" ou `own:<chave>` (alimento
 * próprio definido em `scripts/meals/data/own-foods.json`, fora do Git).
 */
export type Overrides = Record<string, number | "free" | "pending" | `own:${string}`>;

/** Alimento próprio do dono (valores por 100 g ou 100 ml), criado pelo SQL com id determinístico. */
export type OwnFood = {
  key: string;
  name: string;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  /** Observação para o relatório (fonte do valor, ressalvas). */
  note?: string;
  /** Valor proposto sem referência do dono: aparece como "conferir". */
  check?: boolean;
};

/** Alimento do vínculo: da TACO (`taco_id`) ou próprio (`own_key`). */
export type LinkedFood = Omit<TacoFood, "taco_id"> & { taco_id: number | null; own_key?: string };

const OWN_KEY_RE = /^[a-z0-9][a-z0-9-]{0,59}$/;

export function validateOwnFoods(foods: readonly OwnFood[]): void {
  const seen = new Set<string>();
  for (const f of foods) {
    if (!OWN_KEY_RE.test(f.key)) throw new Error(`Alimento próprio com chave inválida: ${f.key}`);
    if (seen.has(f.key)) throw new Error(`Alimento próprio repetido: ${f.key}`);
    seen.add(f.key);
    if (!f.name?.trim() || f.name.length > 200) throw new Error(`Alimento próprio sem nome: ${f.key}`);
    for (const k of ["kcal", "protein_g", "carbs_g", "fat_g"] as const) {
      if (typeof f[k] !== "number" || !Number.isFinite(f[k]) || f[k] < 0) throw new Error(`${f.key}: ${k} inválido`);
    }
  }
}

export type LinkStatus = "auto" | "free" | "pending";

export type ItemLink = {
  name: string;
  qty: string;
  status: LinkStatus;
  /** De onde veio a decisão. */
  via: "à vontade" | "override" | "sinônimo" | "nome igual" | "sem correspondência";
  food: LinkedFood | null;
  grams: number | null;
  note?: string;
  suggestions: TacoFood[];
};

/**
 * Até 3 alimentos da TACO com mais palavras em comum (palavras com 3+ letras). A primeira
 * palavra do item (o alimento em si) precisa aparecer no nome da TACO.
 */
export function suggest(name: string, taco: readonly TacoFood[], limit = 3): TacoFood[] {
  const words = normalizeItemName(name)
    .split(/[\s/,()]+/)
    .filter((w) => w.length >= 3 && !["com", "sem", "light", "de", "do", "da"].includes(w));
  if (words.length === 0) return [];
  const hits = (tokens: string[], w: string) => tokens.some((p) => p.startsWith(w.slice(0, Math.max(3, w.length - 1))));
  return taco
    .map((f) => {
      const t = normalizeTaco(f.name).split(" ");
      if (!hits(t, words[0])) return { f, score: 0 };
      const score = words.filter((w) => hits(t, w)).length;
      return { f, score: score + (t[0]?.startsWith(words[0].slice(0, 3)) ? 0.5 : 0) };
    })
    .filter((x) => x.score >= 1 && x.f.kcal > 0)
    .sort((a, b) => b.score - a.score || a.f.name.length - b.f.name.length)
    .slice(0, limit)
    .map((x) => x.f);
}

/** Decide o vínculo de um item (nome + quantidade do plano). */
export function linkItem(
  item: { name: string; qty: string },
  taco: readonly TacoFood[],
  overrides: Overrides = {},
  ownFoods: readonly OwnFood[] = [],
): ItemLink {
  const parsed = parseQty(item.qty);
  const base = { name: item.name, qty: item.qty, grams: parsed.grams, suggestions: [] as TacoFood[] };
  if (parsed.free) return { ...base, status: "free", via: "à vontade", food: null, grams: 0 };

  const byId = new Map(taco.map((f) => [f.taco_id, f]));
  const byName = new Map(taco.map((f) => [normalizeTaco(f.name), f]));
  const candidates = nameCandidates(item.name);
  const normOverrides = new Map(Object.entries(overrides).map(([k, v]) => [normalizeItemName(k), v]));

  const resolve = (target: number, via: ItemLink["via"], note?: string): ItemLink => {
    const food = byId.get(target);
    if (!food) return { ...base, status: "pending", via, food: null, note: `id ${target} não existe na TACO` };
    if (food.kcal === 0) {
      return {
        ...base,
        status: "pending",
        via,
        food,
        note: "a TACO não tem valores para este alimento (em revisão): cadastre como próprio ou ajuste os valores",
        suggestions: suggest(item.name, taco),
      };
    }
    if (base.grams === null) {
      return { ...base, status: "pending", via, food, note: "quantidade sem gramas: informe as gramas no editor" };
    }
    return { ...base, status: "auto", via, food, ...(note && { note }) };
  };

  const resolveOwn = (key: string): ItemLink => {
    const own = ownFoods.find((f) => f.key === key);
    if (!own) return { ...base, status: "pending", via: "override", food: null, note: `alimento próprio "${key}" não definido` };
    const food: LinkedFood = { taco_id: null, own_key: own.key, name: own.name, category: "Próprio", kcal: own.kcal, protein_g: own.protein_g, carbs_g: own.carbs_g, fat_g: own.fat_g };
    if (base.grams === null) {
      return { ...base, status: "pending", via: "override", food, note: "quantidade sem gramas: informe as gramas no editor" };
    }
    return { ...base, status: "auto", via: "override", food, ...(own.note && { note: own.note }) };
  };

  for (const c of candidates) {
    const o = normOverrides.get(c);
    if (typeof o === "string" && o.startsWith("own:")) return resolveOwn(o.slice(4));
    if (o === "free") return { ...base, status: "free", via: "override", food: null, grams: 0 };
    if (o === "pending") return { ...base, status: "pending", via: "override", food: null, suggestions: suggest(item.name, taco) };
    if (typeof o === "number") return resolve(o, "override");
  }
  for (const c of candidates) {
    const s = SYNONYMS[c];
    if (!s) continue;
    if (s === "free") return { ...base, status: "free", via: "sinônimo", food: null, grams: 0 };
    if ("pending" in s) {
      const listed = (s.suggest ?? []).map((id) => byId.get(id)).filter((f): f is TacoFood => !!f);
      return {
        ...base,
        status: "pending",
        via: "sinônimo",
        food: null,
        note: s.pending,
        suggestions: listed.length ? listed : suggest(item.name, taco),
      };
    }
    return resolve(s.taco, "sinônimo", s.note);
  }
  for (const c of candidates) {
    const f = byName.get(normalizeTaco(c));
    if (f) return resolve(f.taco_id, "nome igual");
  }
  return { ...base, status: "pending", via: "sem correspondência", food: null, suggestions: suggest(item.name, taco) };
}

// ── Seed privado (fonte dos itens do plano) ───────────────────────────────

export type SeedItem = { name: string; qty: string; subs?: string[] };
export type SeedOption = { meal: string; position: number; title: string; items: SeedItem[] };

const SQL_STR = "'((?:[^']|'')*)'";
const unquote = (s: string) => s.replace(/''/g, "'");

/** Opções do `insert into public.meal_options` no formato de `supabase/seed.example.sql`. */
export function parseSeedMealOptions(sql: string): SeedOption[] {
  const re = new RegExp(
    `\\(md5\\(v_uid::text \\|\\| ':meal:' \\|\\| ${SQL_STR} \\|\\| ':option:' \\|\\| (\\d+)\\)::uuid,\\s*v_uid,\\s*` +
      `md5\\(v_uid::text \\|\\| ':meal:' \\|\\| ${SQL_STR}\\)::uuid,\\s*(\\d+),\\s*${SQL_STR},\\s*${SQL_STR}::jsonb\\)`,
    "g",
  );
  return [...sql.matchAll(re)].map((m) => ({
    meal: unquote(m[1]),
    position: Number(m[4]),
    title: unquote(m[5]),
    items: JSON.parse(unquote(m[6])) as SeedItem[],
  }));
}

export function parseSeedOwnerEmail(sql: string): string | null {
  const m = sql.match(new RegExp(`from auth\\.users where email = ${SQL_STR}`));
  return m ? unquote(m[1]) : null;
}

// ── Plano de vínculos e SQL ──────────────────────────────────────────────

export type LinkPlan = {
  options: { option: SeedOption; links: ItemLink[] }[];
  /** Um vínculo por (nome, quantidade) distinto: é a chave usada no SQL. */
  unique: ItemLink[];
  /** Alimentos próprios a criar (ou atualizar) para o dono. */
  ownFoods: OwnFood[];
};

export function planLinks(
  options: readonly SeedOption[],
  taco: readonly TacoFood[],
  overrides: Overrides = {},
  ownFoods: readonly OwnFood[] = [],
): LinkPlan {
  validateOwnFoods(ownFoods);
  const cache = new Map<string, ItemLink>();
  const out = options.map((option) => ({
    option,
    links: option.items.map((item) => {
      const key = JSON.stringify([item.name, item.qty]);
      let link = cache.get(key);
      if (!link) cache.set(key, (link = linkItem(item, taco, overrides, ownFoods)));
      return link;
    }),
  }));
  return { options: out, unique: [...cache.values()], ownFoods: [...ownFoods] };
}

const q = (value: string) => `'${value.replace(/'/g, "''")}'`;
const EMAIL_RE = /^[^\s@'"]+@[^\s@'"]+\.[^\s@'"]+$/;

const num = (n: number) => String(Math.round(n * 100) / 100);

/**
 * SQL idempotente que (1) cria ou atualiza os alimentos próprios do dono, com id
 * determinístico `md5(user_id || ':food:' || chave)`, e (2) grava `food_id`/`grams` (ou
 * `free`) nos itens do plano do dono, casando cada item por (nome, quantidade). Não mexe em
 * item que já tenha `food_id` ou `free` (vínculo ou ajuste feito no app vence). Reaplicar
 * não muda nada.
 */
export function buildLinkSql({ ownerEmail, plan }: { ownerEmail: string; plan: LinkPlan }): string {
  if (!EMAIL_RE.test(ownerEmail)) throw new Error("E-mail do dono inválido.");
  validateOwnFoods(plan.ownFoods);
  const rows = plan.unique.filter((l) => l.status !== "pending");
  const values = rows.map((l) => {
    const auto = l.status === "auto" && l.food;
    const taco = auto && l.food!.taco_id !== null ? String(l.food!.taco_id) : "null";
    const own = auto && l.food!.own_key ? q(l.food!.own_key) : "null";
    return `      (${q(l.name)}, ${q(l.qty)}, ${taco}::int, ${own}::text, ${auto ? num(l.grams!) : "0"}::numeric, ${l.status === "free"})`;
  });
  const ownRows = plan.ownFoods.map(
    (f) => `      (${q(f.key)}, ${q(f.name)}, ${num(f.kcal)}, ${num(f.protein_g)}, ${num(f.carbs_g)}, ${num(f.fat_g)})`,
  );
  const auto = rows.filter((l) => l.status === "auto");
  const ownLinks = auto.filter((l) => l.food?.own_key).length;
  return [
    "-- Vínculo dos itens do plano alimentar com a TACO e alimentos próprios (gerado por scripts/meals/link-foods.ts).",
    "-- DADOS PESSOAIS: não versionar (coberto por supabase/*.private.sql).",
    "-- Idempotente: alimentos próprios com id determinístico (upsert) e só preenche itens sem food_id/free.",
    "-- Aplicar: npx supabase db query --linked -f supabase/meal-items.private.sql",
    `-- ${plan.ownFoods.length} alimentos próprios; ${auto.length - ownLinks} vínculos com a TACO, ${ownLinks} com alimentos próprios ` +
      `e ${rows.length - auto.length} itens livres (0 kcal), por nome + quantidade.`,
    "",
    "do $link$",
    "declare",
    `  v_uid uuid := (select id from auth.users where email = ${q(ownerEmail)});`,
    "  v_taco int := (select count(*) from public.foods where user_id is null and taco_id is not null);",
    "  v_rows int;",
    "begin",
    "  if v_uid is null then",
    "    raise exception 'Usuário dono não encontrado em auth.users.';",
    "  end if;",
    "  if v_taco < 597 then",
    "    raise exception 'A TACO não está carregada (% alimentos). Aplique a migration foods_taco antes.', v_taco;",
    "  end if;",
    "",
    ...(ownRows.length === 0
      ? []
      : [
          "  -- 1) Alimentos próprios do dono (valores por 100 g ou 100 ml).",
          "  insert into public.foods (id, user_id, name, category, kcal, protein_g, carbs_g, fat_g)",
          "  select md5(v_uid::text || ':food:' || v.key)::uuid, v_uid, v.name, 'Próprio', v.kcal, v.protein_g, v.carbs_g, v.fat_g",
          "  from (values",
          ownRows.join(",\n"),
          "  ) as v (key, name, kcal, protein_g, carbs_g, fat_g)",
          "  on conflict (id) do update set",
          "    name = excluded.name, kcal = excluded.kcal, protein_g = excluded.protein_g,",
          "    carbs_g = excluded.carbs_g, fat_g = excluded.fat_g",
          "  where public.foods.user_id = v_uid",
          "    and (public.foods.name, public.foods.kcal, public.foods.protein_g, public.foods.carbs_g, public.foods.fat_g)",
          "      is distinct from (excluded.name, excluded.kcal, excluded.protein_g, excluded.carbs_g, excluded.fat_g);",
          "",
        ]),
    "  -- 2) Itens do plano.",
    rows.length === 0
      ? "  v_rows := 0;"
      : [
          "  with m (name, qty, taco_id, own_key, grams, free) as (",
          "    values",
          values.join(",\n"),
          "  ),",
          "  rebuilt as (",
          "    select o.id, jsonb_agg(",
          "      case",
          "        when t.e ? 'food_id' or t.e ? 'free' or m.name is null then t.e",
          "        when m.free then t.e || jsonb_build_object('free', true, 'grams', 0)",
          "        when m.own_key is not null then",
          "          t.e || jsonb_build_object('food_id', md5(v_uid::text || ':food:' || m.own_key)::uuid, 'grams', m.grams)",
          "        else t.e || jsonb_build_object('food_id', f.id, 'grams', m.grams)",
          "      end order by t.ord) as items",
          "    from public.meal_options o",
          "    cross join lateral jsonb_array_elements(o.items) with ordinality as t (e, ord)",
          "    left join m on m.name = t.e ->> 'name' and m.qty = t.e ->> 'qty'",
          "    left join public.foods f on f.taco_id = m.taco_id and f.user_id is null",
          "    where o.user_id = v_uid and jsonb_array_length(o.items) > 0",
          "    group by o.id",
          "  )",
          "  update public.meal_options o set items = r.items",
          "  from rebuilt r",
          "  where o.id = r.id and o.user_id = v_uid and o.items is distinct from r.items;",
          "  get diagnostics v_rows = row_count;",
        ].join("\n"),
    "  raise notice 'Opções atualizadas: %', v_rows;",
    "end",
    "$link$;",
    "",
  ].join("\n");
}
