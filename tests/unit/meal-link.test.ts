import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildLinkSql,
  linkItem,
  nameCandidates,
  parseSeedMealOptions,
  parseSeedOwnerEmail,
  planLinks,
  SYNONYMS,
  type SeedOption,
} from "../../scripts/meals/link";
import { renderLinkReport } from "../../scripts/meals/report";
import { buildTacoMigration, parseTacoMigration, tacoNumber, tacoToFoods } from "../../scripts/taco/taco";
import { storedMealItemsSchema } from "@/lib/schemas/meal";

// Só dados públicos (TACO) e fictícios (seed de exemplo): nada do plano real do dono.
const migrationFile = readdirSync(join(process.cwd(), "supabase/migrations")).find((f) => f.endsWith("_foods_taco.sql"))!;
const TACO = parseTacoMigration(readFileSync(join(process.cwd(), "supabase/migrations", migrationFile), "utf8"));
const byId = new Map(TACO.map((f) => [f.taco_id, f]));

describe("TACO → migration", () => {
  it("valores especiais viram 0 (NA, Tr, *, vazio e negativos)", () => {
    expect(["NA", "Tr", "*", "", null, undefined, -0.03].map(tacoNumber)).toEqual([0, 0, 0, 0, 0, 0, 0]);
    expect(tacoNumber(123.5348925)).toBe(123.53);
    expect(tacoNumber("2,5")).toBe(2.5);
  });

  it("converte, gera SQL idempotente e lê de volta igual", () => {
    const foods = tacoToFoods([
      { id: 2, description: "Feijão, d'água", category: "Leguminosas", energy_kcal: 76.4, protein_g: "Tr", lipid_g: 0.5, carbohydrate_g: 13.6 },
      { id: 1, description: "Arroz,  integral, cozido", category: "Cereais", energy_kcal: 123.53, protein_g: 2.59, lipid_g: 1, carbohydrate_g: 25.81 },
    ]);
    expect(foods.map((f) => f.taco_id)).toEqual([1, 2]);
    expect(foods[0].name).toBe("Arroz, integral, cozido");
    const sql = buildTacoMigration(foods);
    expect(sql).toContain("on conflict (taco_id) do update");
    expect(sql).toContain("md5('taco:' || v.taco_id)::uuid");
    expect(parseTacoMigration(sql)).toEqual(foods);
    expect(buildTacoMigration(foods)).toBe(sql);
  });

  it("recusa estrutura inesperada", () => {
    expect(() => tacoToFoods({})).toThrow();
    expect(() => tacoToFoods([{ id: 1, description: "" }])).toThrow();
  });

  it("a migration versionada tem os 597 alimentos e o arroz integral cozido", () => {
    expect(TACO).toHaveLength(597);
    expect(byId.get(1)).toMatchObject({ name: "Arroz, integral, cozido", kcal: 123.53, protein_g: 2.59, carbs_g: 25.81, fat_g: 1 });
  });
});

describe("sinônimos", () => {
  it("todo id aponta para um alimento existente da TACO", () => {
    for (const [key, s] of Object.entries(SYNONYMS)) {
      if (s === "free") continue;
      if ("taco" in s) expect(byId.get(s.taco), key).toBeDefined();
      if ("pending" in s) for (const id of s.suggest ?? []) expect(byId.get(id), key).toBeDefined();
    }
  });

  it("casos conhecidos", () => {
    expect(byId.get((SYNONYMS["file de frango grelhado"] as { taco: number }).taco)?.name).toBe("Frango, peito, sem pele, grelhado");
    expect(byId.get((SYNONYMS["arroz branco cozido"] as { taco: number }).taco)?.name).toBe("Arroz, tipo 1, cozido");
    expect(byId.get((SYNONYMS["pao de forma"] as { taco: number }).taco)?.name).toBe("Pão, trigo, forma, integral");
  });
});

describe("linkItem", () => {
  it("nome inteiro e primeira alternativa", () => {
    expect(nameCandidates("Peixe assado/cozido")).toEqual(["peixe assado/cozido", "peixe assado"]);
    expect(nameCandidates("Batata-doce ou inhame")).toEqual(["batata doce ou inhame", "batata doce"]);
    expect(nameCandidates("Iogurte light")).toEqual(["iogurte light", "iogurte"]);
  });

  it("sinônimo com gramas da quantidade", () => {
    expect(linkItem({ name: "Filé de frango grelhado", qty: "4 un (200 g)" }, TACO)).toMatchObject({
      status: "auto",
      via: "sinônimo",
      grams: 200,
      food: { name: "Frango, peito, sem pele, grelhado" },
    });
  });

  it("nome igual ao da TACO", () => {
    expect(linkItem({ name: "Arroz, integral, cozido", qty: "150 g" }, TACO)).toMatchObject({ status: "auto", via: "nome igual", grams: 150 });
  });

  it("à vontade e água são livres", () => {
    expect(linkItem({ name: "Folhas", qty: "à vontade" }, TACO)).toMatchObject({ status: "free", grams: 0 });
    expect(linkItem({ name: "Água", qty: "300 ml" }, TACO)).toMatchObject({ status: "free" });
  });

  it("suplemento sem TACO fica pendente com motivo", () => {
    expect(linkItem({ name: "Whey protein", qty: "30 g" }, TACO)).toMatchObject({ status: "pending", food: null, note: expect.stringContaining("suplemento") });
  });

  it("alimento da TACO sem valores fica pendente, com sugestões", () => {
    const l = linkItem({ name: "Leite integral", qty: "200 ml" }, TACO);
    expect(l).toMatchObject({ status: "pending", food: { taco_id: 458 } });
    expect(l.suggestions.every((f) => f.kcal > 0)).toBe(true);
  });

  it("quantidade sem gramas fica pendente", () => {
    expect(linkItem({ name: "Ovo", qty: "2 un" }, TACO)).toMatchObject({ status: "pending", food: { taco_id: 488 }, grams: null });
  });

  it("sem correspondência sugere pela primeira palavra", () => {
    const l = linkItem({ name: "Hambúrguer artesanal", qty: "120 g" }, TACO);
    expect(l.status).toBe("pending");
    expect(l.suggestions[0]?.name).toMatch(/^Hambúrguer/);
  });

  it("override do dono vence o sinônimo", () => {
    expect(linkItem({ name: "Banana", qty: "100 g" }, TACO, { banana: 179 })).toMatchObject({ status: "auto", via: "override", food: { taco_id: 179 } });
    expect(linkItem({ name: "Banana", qty: "100 g" }, TACO, { Banana: "pending" })).toMatchObject({ status: "pending" });
  });
});

describe("seed, plano e SQL", () => {
  const seed = readFileSync(join(process.cwd(), "supabase/seed.example.sql"), "utf8");

  it("lê as opções e o e-mail do seed (exemplo fictício)", () => {
    const options = parseSeedMealOptions(seed);
    expect(options.length).toBeGreaterThan(5);
    expect(options[0]).toMatchObject({ meal: "Ao acordar", position: 1, title: "Hidratação" });
    expect(options[0].items[0]).toEqual({ name: "Água", qty: "300 ml", subs: [] });
    expect(parseSeedOwnerEmail(seed)).toBe("e2e@bctrl.test");
  });

  const options: SeedOption[] = [
    { meal: "Almoço", position: 1, title: "Prato", items: [{ name: "Arroz", qty: "100 g" }, { name: "Molho d'ervas", qty: "10 g" }] },
    { meal: "Jantar", position: 1, title: "Prato", items: [{ name: "Arroz", qty: "100 g" }, { name: "Salada", qty: "à vontade" }] },
  ];

  it("um vínculo por nome + quantidade; SQL determinístico e escapado", () => {
    const plan = planLinks(options, TACO);
    expect(plan.unique.map((l) => [l.name, l.status])).toEqual([
      ["Arroz", "auto"],
      ["Molho d'ervas", "pending"],
      ["Salada", "free"],
    ]);
    const sql = buildLinkSql({ ownerEmail: "dono@exemplo.com", plan });
    expect(sql).toContain("where email = 'dono@exemplo.com'");
    expect(sql).toContain("('Arroz', '100 g', 3, 100, false)");
    expect(sql).toContain("('Salada', 'à vontade', null, 0, true)");
    expect(sql).not.toContain("ervas"); // pendente não entra no SQL
    expect(sql).toContain("when t.e ? 'food_id' or t.e ? 'free' or m.name is null then t.e");
    expect(buildLinkSql({ ownerEmail: "dono@exemplo.com", plan })).toBe(sql);
    expect(() => buildLinkSql({ ownerEmail: "x' or 1=1 --", plan })).toThrow();
  });

  it("relatório com resumo, pendentes e totais por opção", () => {
    const md = renderLinkReport(planLinks(options, TACO), { generatedAt: "2026-10-19", source: "plano.json" });
    expect(md).toContain("**1 automáticos**");
    expect(md).toContain("**1 pendentes**");
    expect(md).toContain("| Almoço | 1. Prato | 128 |");
  });
});

describe("itens do plano (Zod)", () => {
  it("itens da v1 continuam válidos e os campos novos são lidos", () => {
    const id = "a04a8859-dd78-2c7c-cc4d-4da5ca1e848d";
    expect(
      storedMealItemsSchema.parse([
        { name: "Ovo", qty: "2 un", subs: [] },
        { name: "Arroz", qty: "150 g", subs: [], food_id: id, grams: 150, macros_override: { kcal: 200 }, free: false },
      ]),
    ).toEqual([
      { name: "Ovo", qty: "2 un", subs: [] },
      { name: "Arroz", qty: "150 g", subs: [], food_id: id, grams: 150, macros_override: { kcal: 200 }, free: false },
    ]);
  });

  it("campo novo inválido é ignorado sem perder o item", () => {
    const [item] = storedMealItemsSchema.parse([{ name: "X", qty: "1", subs: [], food_id: "nao-e-uuid", grams: -5, free: "sim" }]);
    expect(item).toMatchObject({ name: "X", food_id: undefined, grams: undefined, free: undefined });
  });
});
