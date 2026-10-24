import { describe, expect, it } from "vitest";
import {
  itemGrams,
  itemMacros,
  optionMacros,
  parseQty,
  planItemMacros,
  roundMacros,
  searchFoods,
  type Food,
  type PlanItem,
} from "@/features/nutrition/domain/nutrition";

// Valores reais da TACO (por 100 g), arredondados como na migration.
const arroz: Food = { id: "arroz", name: "Arroz, integral, cozido", kcal: 123.53, protein_g: 2.59, carbs_g: 25.81, fat_g: 1 };
const ovo: Food = {
  id: "ovo",
  name: "Ovo, de galinha, inteiro, cozido/10minutos",
  kcal: 145.67,
  protein_g: 13.29,
  carbs_g: 0.61,
  fat_g: 9.48,
  unit_grams: { un: 50 },
};
const foods = new Map([arroz, ovo].map((f) => [f.id, f]));

describe("parseQty", () => {
  it.each([
    ["4 un (200 g)", 200],
    ["1 fatia média (170 g)", 170],
    ["5 ml (5g)", 5],
    ["160g", 160],
    ["160 g", 160],
    ["500 ml", 500],
    ["1,5 un (76,9 g)", 76.9],
    ["0,2 kg", 200],
  ])("%s → %s g", (qty, grams) => {
    expect(parseQty(qty)).toMatchObject({ grams, free: false });
  });

  it("à vontade é livre (0 g), com ou sem acento", () => {
    expect(parseQty("à vontade")).toEqual({ grams: 0, free: true, units: null });
    expect(parseQty("A vontade")).toMatchObject({ free: true });
  });

  it("contagem sem peso guarda as unidades", () => {
    expect(parseQty("3 un")).toEqual({ grams: null, free: false, units: { count: 3, unit: "un" } });
    expect(parseQty("2 fatias")).toMatchObject({ units: { count: 2, unit: "fatia" } });
    expect(parseQty("2 colheres")).toMatchObject({ units: { count: 2, unit: "colher" } });
  });

  it("texto sem número fica sem gramas", () => {
    expect(parseQty("")).toEqual({ grams: null, free: false, units: null });
    expect(parseQty("um punhado")).toEqual({ grams: null, free: false, units: null });
  });
});

describe("itemGrams", () => {
  it("gramas gravadas têm prioridade sobre a quantidade", () => {
    expect(itemGrams({ qty: "4 un (200 g)", grams: 180 }, null)).toBe(180);
  });
  it("sem gramas gravadas, usa a quantidade", () => {
    expect(itemGrams({ qty: "150 g" }, null)).toBe(150);
  });
  it("unidades × peso por unidade do alimento", () => {
    expect(itemGrams({ qty: "3 un" }, ovo)).toBe(150);
    expect(itemGrams({ qty: "3 un" }, arroz)).toBeNull();
  });
});

describe("itemMacros", () => {
  it("arroz integral cozido 150 g ≈ 185 kcal / 3,9 P / 38,7 C / 1,5 G", () => {
    expect(roundMacros(itemMacros(arroz, 150)!)).toEqual({ kcal: 185, protein: 3.9, carbs: 38.7, fat: 1.5 });
  });

  it("override parcial substitui só os campos informados", () => {
    const m = itemMacros(arroz, 100, { kcal: 200 })!;
    expect(m.kcal).toBe(200);
    expect(m.protein).toBeCloseTo(2.59);
  });

  it("override completo vale mesmo sem alimento", () => {
    expect(itemMacros(null, null, { kcal: 120, protein: 24, carbs: 3, fat: 1 })).toEqual({
      kcal: 120,
      protein: 24,
      carbs: 3,
      fat: 1,
    });
  });

  it("sem alimento ou sem gramas (e sem override completo) é sem valor", () => {
    expect(itemMacros(null, 100)).toBeNull();
    expect(itemMacros(arroz, null)).toBeNull();
    expect(itemMacros(null, 100, { kcal: 50 })).toBeNull();
  });
});

describe("planItemMacros / optionMacros", () => {
  const item = (p: Partial<PlanItem>): PlanItem => ({ name: "Item", qty: "", ...p });

  it("item à vontade vale 0 e não é pendente", () => {
    expect(planItemMacros(item({ qty: "à vontade" }), foods)).toEqual({ kcal: 0, protein: 0, carbs: 0, fat: 0 });
    expect(planItemMacros(item({ qty: "100 g", free: true }), foods)).toEqual({ kcal: 0, protein: 0, carbs: 0, fat: 0 });
  });

  it("free: false gravado vence o texto da quantidade", () => {
    expect(planItemMacros(item({ qty: "à vontade", free: false }), foods)).toBeNull();
  });

  it("soma os itens resolvidos e conta os sem valor", () => {
    const { total, unresolved } = optionMacros(
      [
        item({ name: "Arroz", qty: "150 g", food_id: "arroz" }),
        item({ name: "Ovo", qty: "4 un (200 g)", food_id: "ovo", grams: 200 }),
        item({ name: "Salada", qty: "à vontade" }),
        item({ name: "Suplemento", qty: "30 g" }), // sem alimento
        item({ name: "Arroz sumido", qty: "100 g", food_id: "apagado" }), // alimento inexistente
      ],
      foods,
    );
    expect(unresolved).toBe(2);
    expect(roundMacros(total)).toEqual({ kcal: 477, protein: 30.5, carbs: 39.9, fat: 20.5 });
  });

  it("opção vazia: zero, sem pendentes", () => {
    expect(optionMacros([], foods)).toEqual({ total: { kcal: 0, protein: 0, carbs: 0, fat: 0 }, unresolved: 0 });
  });
});

describe("searchFoods", () => {
  const list = [
    { name: "Pão, trigo, francês" },
    { name: "Pão, trigo, forma, integral" },
    { name: "Arroz, tipo 1, cozido" },
    { name: "Farinha, de arroz, enriquecida" },
    { name: "Arroz, integral, cozido" },
  ];

  it("ignora acento e caixa e exige todas as palavras", () => {
    expect(searchFoods(list, "PAO forma").map((f) => f.name)).toEqual(["Pão, trigo, forma, integral"]);
  });

  it("nome que começa com a busca vem antes", () => {
    expect(searchFoods(list, "arroz").map((f) => f.name)).toEqual([
      "Arroz, tipo 1, cozido",
      "Arroz, integral, cozido",
      "Farinha, de arroz, enriquecida",
    ]);
  });

  it("busca vazia não lista nada", () => {
    expect(searchFoods(list, "  ")).toEqual([]);
  });
});
