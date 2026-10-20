import { describe, expect, it } from "vitest";
import { monthNutrition, type Food, type PlanItem } from "@/lib/domain/nutrition";

const arroz: Food = { id: "arroz", name: "Arroz", kcal: 124, protein_g: 2.6, carbs_g: 25.8, fat_g: 1 };
const foods = new Map([[arroz.id, arroz]]);

const items = new Map<string, PlanItem[]>([
  ["cafe", [{ name: "Café", qty: "1 un", macros_override: { kcal: 300, protein: 20, carbs: 30, fat: 10 } }]],
  // 200 g de arroz = 248 kcal, 5,2 g de proteína; salada à vontade = 0; item sem valor não entra.
  [
    "almoco",
    [
      { name: "Arroz", qty: "200 g", food_id: "arroz" },
      { name: "Salada", qty: "à vontade" },
      { name: "Molho", qty: "1 colher" },
    ],
  ],
]);

describe("monthNutrition: médias do mês × meta", () => {
  it("média por dia registrado: opções marcadas × vezes + fora do plano; meta média por dia de treino/descanso", () => {
    const out = monthNutrition(
      {
        logged_days: 4,
        training_days: 1,
        options: [
          { option_id: "cafe", count: 4 },
          { option_id: "almoco", count: 2 },
          { option_id: "apagada", count: 1 }, // opção que não existe mais no plano
        ],
        off_plan: { kcal: 185, protein: 3.9, carbs: 38.6, fat: 1.5 },
      },
      items,
      foods,
      { rest: { kcal: 2000, protein: 160, carbs: 200, fat: 60 }, training: { kcal: 2200, protein: 160, carbs: 250, fat: 60 } },
    );
    // kcal: (4×300 + 2×248 + 185) / 4 = 1881 / 4 = 470,25
    expect(out.days).toBe(4);
    expect(out.consumed!.kcal).toBeCloseTo(470.25, 6);
    // proteína: (4×20 + 2×5,2 + 3,9) / 4 = 94,3 / 4
    expect(out.consumed!.protein).toBeCloseTo(23.575, 6);
    // 2× o molho sem valor + 1 opção apagada.
    expect(out.unresolved).toBe(3);
    // meta: (3×2000 + 1×2200) / 4 = 2050
    expect(out.goal).toEqual({ kcal: 2050, protein: 160, carbs: 212.5, fat: 60 });
  });

  it("sem dias registrados: sem média; sem meta (perfil incompleto): só o consumido", () => {
    const empty = { logged_days: 0, training_days: 0, options: [], off_plan: { kcal: 0, protein: 0, carbs: 0, fat: 0 } };
    expect(monthNutrition(empty, items, foods, null)).toEqual({ days: 0, consumed: null, goal: null, unresolved: 0 });
    const one = { ...empty, logged_days: 1, options: [{ option_id: "cafe", count: 1 }] };
    expect(monthNutrition(one, items, foods, null)).toMatchObject({ consumed: { kcal: 300, protein: 20 }, goal: null });
  });
});
