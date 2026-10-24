import { describe, expect, it } from "vitest";
import {
  ageOn,
  amountToGrams,
  amountUnits,
  dayTotals,
  foodSnapshot,
  goalBreakdown,
  goalsFromProfile,
  isCompleteProfile,
  macroProgress,
  snapshotMacros,
  type CompleteProfile,
  type Food,
} from "@/features/nutrition/domain/nutrition";

/** Dia de referência das idades (o cálculo usa a idade em anos completos nesse dia). */
const ON = "2026-10-20";

/*
 * Perfil A (exemplo da task): homem, 30 anos, 180 cm, 80 kg, moderado, manter, 2,0 g/kg.
 *   TMB    = 10·80 + 6,25·180 − 5·30 + 5      = 800 + 1125 − 150 + 5 = 1780
 *   Gasto  = 1780 × 1,55                       = 2759
 *   Kcal   = 2759 × (1 + 0)                    = 2759
 *   Prot.  = 2,0 × 80                          = 160 g  (640 kcal)
 *   Gord.  = máx(0,8 × 80 = 64; 20% · 2759 ÷ 9 = 61,3) = 64 g (576 kcal)
 *   Carb.  = (2759 − 640 − 576) ÷ 4 = 1543 ÷ 4 = 385,75 → 386 g
 *   Treino: carb. 385,75 × 1,1 = 424,325 → 424 g; kcal 2759 + 38,575 × 4 = 2913,3 → 2913
 *   Ganhar: kcal 2759 × 1,1 = 3034,9 → 3035; gordura pelo piso 20% · 3034,9 ÷ 9 = 67,44 → 67 g;
 *           carb. (3034,9 − 640 − 606,98) ÷ 4 = 446,98 → 447 g
 *   Perder: kcal 2759 × 0,8 = 2207,2 → 2207; gordura 64 g (piso 49,0); carb. (2207,2 − 640 − 576) ÷ 4 = 247,8 → 248 g
 */
const male: CompleteProfile = {
  sex: "m",
  birth_date: "1996-05-10",
  height_cm: 180,
  activity_level: "moderate",
  goal: "maintain",
  protein_g_per_kg: 2,
  goal_overrides: {},
};

/*
 * Perfil B: mulher, 24 anos (faz 25 em dezembro), 165 cm, 60 kg, leve, perder, 1,8 g/kg.
 *   TMB    = 10·60 + 6,25·165 − 5·24 − 161     = 600 + 1031,25 − 120 − 161 = 1350,25
 *   Gasto  = 1350,25 × 1,375                   = 1856,59
 *   Kcal   = 1856,59 × 0,8                     = 1485,28 → 1485
 *   Prot.  = 1,8 × 60                          = 108 g  (432 kcal)
 *   Gord.  = máx(0,8 × 60 = 48; 20% · 1485,28 ÷ 9 = 33,0) = 48 g (432 kcal)
 *   Carb.  = (1485,28 − 432 − 432) ÷ 4 = 621,28 ÷ 4 = 155,32 → 155 g
 *   Treino: carb. 155,32 × 1,1 = 170,85 → 171 g; kcal 1485,28 + 15,53 × 4 = 1547,40 → 1547
 */
const female: CompleteProfile = {
  sex: "f",
  birth_date: "2001-12-01",
  height_cm: 165,
  activity_level: "light",
  goal: "lose",
  protein_g_per_kg: 1.8,
  goal_overrides: {},
};

describe("ageOn", () => {
  it("conta anos completos (antes e depois do aniversário)", () => {
    expect(ageOn("1996-05-10", ON)).toBe(30);
    expect(ageOn("2001-12-01", ON)).toBe(24);
    expect(ageOn("2001-10-20", ON)).toBe(25);
    expect(ageOn("2001-10-21", ON)).toBe(24);
  });
});

describe("goalsFromProfile — perfil A (m, 30 anos, 180 cm, 80 kg, moderado, manter)", () => {
  it("mostra a conta passo a passo", () => {
    const b = goalBreakdown(male, 80, ON);
    expect(b.age).toBe(30);
    expect(b.bmr).toBe(1780);
    expect(b.factor).toBe(1.55);
    expect(b.tdee).toBeCloseTo(2759, 6);
    expect(b.kcal).toBeCloseTo(2759, 6);
    expect(b.protein).toBe(160);
    expect(b.fatPerKg).toBe(64);
    expect(b.fatMin).toBeCloseTo(61.311, 2);
    expect(b.fat).toBe(64);
    expect(b.carbs).toBeCloseTo(385.75, 6);
  });

  it("dia sem treino", () => {
    expect(goalsFromProfile(male, 80, false, ON)).toEqual({ kcal: 2759, protein: 160, carbs: 386, fat: 64 });
  });

  it("dia de treino: +10% de carboidrato e as kcal acompanham", () => {
    expect(goalsFromProfile(male, 80, true, ON)).toEqual({ kcal: 2913, protein: 160, carbs: 424, fat: 64 });
  });

  it("ganhar: +10% de kcal e a gordura sobe para o piso de 20% das kcal", () => {
    expect(goalsFromProfile({ ...male, goal: "gain" }, 80, false, ON)).toEqual({ kcal: 3035, protein: 160, carbs: 447, fat: 67 });
  });

  it("perder: −20% de kcal", () => {
    expect(goalsFromProfile({ ...male, goal: "lose" }, 80, false, ON)).toEqual({ kcal: 2207, protein: 160, carbs: 248, fat: 64 });
  });
});

describe("goalsFromProfile — perfil B (f, 24 anos, 165 cm, 60 kg, leve, perder)", () => {
  it("conta passo a passo", () => {
    const b = goalBreakdown(female, 60, ON);
    expect(b.bmr).toBe(1350.25);
    expect(b.tdee).toBeCloseTo(1856.59375, 6);
    expect(b.kcal).toBeCloseTo(1485.275, 6);
    expect(b.fatMin).toBeCloseTo(33.006, 2);
    expect(b.carbs).toBeCloseTo(155.31875, 6);
  });

  it("dia sem treino e de treino", () => {
    expect(goalsFromProfile(female, 60, false, ON)).toEqual({ kcal: 1485, protein: 108, carbs: 155, fat: 48 });
    expect(goalsFromProfile(female, 60, true, ON)).toEqual({ kcal: 1547, protein: 108, carbs: 171, fat: 48 });
  });
});

describe("goalsFromProfile — ajuste manual (goal_overrides)", () => {
  it("override do dia normal substitui só os macros informados", () => {
    const p = { ...male, goal_overrides: { rest: { kcal: 2500, protein: 180 } } };
    expect(goalsFromProfile(p, 80, false, ON)).toEqual({ kcal: 2500, protein: 180, carbs: 386, fat: 64 });
    // Treino sem override próprio: parte do dia normal ajustado, +10% de carboidrato.
    // kcal = 2500 + 38,575 × 4 = 2654,3 → 2654
    expect(goalsFromProfile(p, 80, true, ON)).toEqual({ kcal: 2654, protein: 180, carbs: 424, fat: 64 });
  });

  it("override de treino substitui o +10%", () => {
    // carboidrato 450: kcal = 2759 + (450 − 385,75) × 4 = 3016
    const carbs = { ...male, goal_overrides: { training: { carbs: 450 } } };
    expect(goalsFromProfile(carbs, 80, true, ON)).toEqual({ kcal: 3016, protein: 160, carbs: 450, fat: 64 });
    expect(goalsFromProfile(carbs, 80, false, ON)).toEqual({ kcal: 2759, protein: 160, carbs: 386, fat: 64 });

    const all = { ...male, goal_overrides: { training: { kcal: 3000, protein: 170, carbs: 400, fat: 70 } } };
    expect(goalsFromProfile(all, 80, true, ON)).toEqual({ kcal: 3000, protein: 170, carbs: 400, fat: 70 });
  });

  it("valores inválidos no override são ignorados", () => {
    const p = { ...male, goal_overrides: { rest: { kcal: Number.NaN, protein: -1 } } };
    expect(goalsFromProfile(p, 80, false, ON)).toEqual({ kcal: 2759, protein: 160, carbs: 386, fat: 64 });
  });
});

describe("isCompleteProfile", () => {
  it("exige sexo, nascimento, altura, atividade e objetivo", () => {
    expect(isCompleteProfile(male)).toBe(true);
    expect(isCompleteProfile(null)).toBe(false);
    expect(isCompleteProfile({ ...male, sex: null })).toBe(false);
    expect(isCompleteProfile({ ...male, height_cm: null })).toBe(false);
    expect(isCompleteProfile({ ...male, goal: null })).toBe(false);
  });
});

describe("dayTotals e snapshot", () => {
  const arroz: Food = { id: "arroz", name: "Arroz, integral, cozido", kcal: 123.53, protein_g: 2.59, carbs_g: 25.81, fat_g: 1 };

  it("snapshot de 150 g de arroz integral ≈ 185 kcal", () => {
    expect(foodSnapshot(arroz, 150)).toEqual({ kcal: 185.3, protein_g: 3.9, carbs_g: 38.7, fat_g: 1.5 });
  });

  it("soma opções marcadas e itens fora do plano", () => {
    const option = { kcal: 375, protein: 39.9, carbs: 38.7, fat: 6 };
    const off = snapshotMacros(foodSnapshot(arroz, 150));
    const total = dayTotals({ options: [option], offPlan: [off, off] });
    expect(total.kcal).toBeCloseTo(745.6, 6);
    expect(total.protein).toBeCloseTo(47.7, 6);
    expect(dayTotals({ options: [], offPlan: [] })).toEqual({ kcal: 0, protein: 0, carbs: 0, fat: 0 });
  });

  it("o total usa o snapshot: editar o alimento depois não muda o dia", () => {
    const saved = foodSnapshot(arroz, 150);
    arroz.kcal = 999;
    expect(dayTotals({ options: [], offPlan: [snapshotMacros(saved)] }).kcal).toBe(185.3);
  });
});

describe("macroProgress", () => {
  it("faltando e excedente pelos valores exibidos", () => {
    const [kcal, protein, carbs, fat] = macroProgress(
      { kcal: 1000.4, protein: 170.04, carbs: 386, fat: 0 },
      { kcal: 2759, protein: 160, carbs: 386, fat: 64 },
    );
    expect(kcal).toMatchObject({ key: "kcal", consumed: 1000, remaining: 1759, excess: 0 });
    expect(protein).toMatchObject({ key: "protein", consumed: 170, remaining: 0, excess: 10 });
    expect(protein.ratio).toBeCloseTo(1.0625, 6);
    expect(carbs).toMatchObject({ remaining: 0, excess: 0, ratio: 1 });
    expect(fat).toMatchObject({ remaining: 64, excess: 0, ratio: 0 });
  });

  it("meta zero não divide por zero", () => {
    expect(macroProgress({ kcal: 10, protein: 0, carbs: 0, fat: 0 }, { kcal: 0, protein: 0, carbs: 0, fat: 0 })[0]).toMatchObject({
      ratio: 0,
      excess: 10,
    });
  });
});

describe("amountUnits e amountToGrams", () => {
  it("g, ml e unidades com peso de referência", () => {
    const units = amountUnits({ unit_grams: { un: 50, fatia: 25, ruim: -1 } });
    expect(units.map((u) => u.key)).toEqual(["g", "ml", "un", "fatia"]);
    expect(amountToGrams(2, units[2])).toBe(100);
    expect(amountToGrams(1.5, units[3])).toBe(37.5);
    expect(amountToGrams(250, units[1])).toBe(250);
    expect(amountToGrams(0, units[0])).toBeNull();
    expect(amountToGrams(null, units[0])).toBeNull();
    expect(amountUnits({ unit_grams: null }).map((u) => u.key)).toEqual(["g", "ml"]);
  });
});

/*
 * v3: TMB da balança e proteína por massa magra (perfil A, 80 kg, dia de referência 20/10/2026).
 *   TMB da balança 1900 → gasto 1900 × 1,55 = 2945 = kcal (manter)
 *   Prot. 2,0 × 80 = 160 g (640 kcal) · Gord. máx(64; 20% · 2945 ÷ 9 = 65,44) = 65,44 g (589 kcal)
 *   Carb. (2945 − 640 − 589) ÷ 4 = 1716 ÷ 4 = 429 g
 *   Massa magra 65 kg × 2,5 g/kg = 162,5 g (650 kcal), com a fórmula (kcal 2759, gordura 64 g):
 *   Carb. (2759 − 650 − 576) ÷ 4 = 1533 ÷ 4 = 383,25 g
 */
describe("goalBreakdown — fonte da TMB e base da proteína (v3)", () => {
  const scale = { measuredKcal: 1900, measuredOn: "2026-10-05" };

  it("sem medição, nada muda: fórmula e base peso (a v2 não regride)", () => {
    const b = goalBreakdown(male, 80, ON);
    expect(b).toMatchObject({ bmr: 1780, bmrSource: "formula", proteinBasis: "weight", bmrFallback: false });
    expect(b.bmrDate).toBeUndefined();
    expect(goalBreakdown(male, 80, ON, {})).toEqual(b);
    expect(goalsFromProfile(male, 80, false, ON, {})).toEqual({ kcal: 2759, protein: 160, carbs: 386, fat: 64 });
  });

  it("auto (padrão) com medição de até 30 dias usa a TMB da balança", () => {
    const b = goalBreakdown(male, 80, ON, scale);
    expect(b).toMatchObject({ bmr: 1900, bmrSource: "scale", bmrDate: "2026-10-05", bmrFallback: false });
    expect(b.kcal).toBeCloseTo(2945, 6);
    expect(b.fat).toBeCloseTo(65.444, 2);
    expect(b.carbs).toBeCloseTo(429, 6);
    expect(goalsFromProfile(male, 80, false, ON, scale)).toEqual({ kcal: 2945, protein: 160, carbs: 429, fat: 65 });
    expect(goalsFromProfile({ ...male, bmr_source: "auto" }, 80, false, ON, scale)).toEqual({ kcal: 2945, protein: 160, carbs: 429, fat: 65 });
  });

  it("auto: 30 dias ainda vale; 31 dias volta para a fórmula; sem data, fórmula", () => {
    expect(goalBreakdown(male, 80, ON, { measuredKcal: 1900, measuredOn: "2026-09-20" }).bmrSource).toBe("scale");
    const old = goalBreakdown(male, 80, ON, { measuredKcal: 1900, measuredOn: "2026-09-19" });
    expect(old).toMatchObject({ bmr: 1780, bmrSource: "formula", bmrFallback: false });
    expect(old.bmrDate).toBeUndefined();
    expect(goalBreakdown(male, 80, ON, { measuredKcal: 1900 }).bmrSource).toBe("formula");
  });

  it("scale: usa a balança mesmo com mais de 30 dias; sem medição, cai na fórmula sinalizando a reserva", () => {
    const p = { ...male, bmr_source: "scale" as const };
    expect(goalBreakdown(p, 80, ON, { measuredKcal: 1900, measuredOn: "2026-06-01" })).toMatchObject({
      bmr: 1900,
      bmrSource: "scale",
      bmrDate: "2026-06-01",
      bmrFallback: false,
    });
    expect(goalBreakdown(p, 80, ON)).toMatchObject({ bmr: 1780, bmrSource: "formula", bmrFallback: true });
  });

  it("formula: sempre Mifflin-St Jeor, mesmo com medição recente", () => {
    const b = goalBreakdown({ ...male, bmr_source: "formula" }, 80, ON, scale);
    expect(b).toMatchObject({ bmr: 1780, bmrSource: "formula", bmrFallback: false });
  });

  it("TMB medida inválida é ignorada", () => {
    expect(goalBreakdown(male, 80, ON, { measuredKcal: 0, measuredOn: "2026-10-05" }).bmrSource).toBe("formula");
    expect(goalBreakdown(male, 80, ON, { measuredKcal: Number.NaN, measuredOn: "2026-10-05" }).bmrSource).toBe("formula");
  });

  it("proteína por massa magra: 2,5 g/kg padrão × massa magra", () => {
    const p = { ...male, protein_basis: "lean_mass" as const };
    const b = goalBreakdown(p, 80, ON, { leanMassKg: 65 });
    expect(b).toMatchObject({ proteinBasis: "lean_mass", protein: 162.5, bmrSource: "formula" });
    expect(b.carbs).toBeCloseTo(383.25, 6);
    expect(goalsFromProfile(p, 80, false, ON, { leanMassKg: 65 })).toEqual({ kcal: 2759, protein: 163, carbs: 383, fat: 64 });
  });

  it("proteína por massa magra com g/kg ajustado", () => {
    const p = { ...male, protein_basis: "lean_mass" as const, protein_g_per_kg_lean: 2.2 };
    expect(goalBreakdown(p, 80, ON, { leanMassKg: 65 }).protein).toBeCloseTo(143, 6);
  });

  it("massa magra ausente ou inválida: volta para a base peso", () => {
    const p = { ...male, protein_basis: "lean_mass" as const };
    expect(goalBreakdown(p, 80, ON)).toMatchObject({ proteinBasis: "weight", protein: 160 });
    expect(goalBreakdown(p, 80, ON, { leanMassKg: 0 })).toMatchObject({ proteinBasis: "weight", protein: 160 });
  });

  it("base peso ignora a massa magra", () => {
    expect(goalBreakdown(male, 80, ON, { leanMassKg: 65 })).toMatchObject({ proteinBasis: "weight", protein: 160 });
  });

  it("balança e massa magra juntas, no dia de treino", () => {
    // kcal 2945; prot. 162,5 (650); gord. 65,44 (589); carb. (2945 − 650 − 589) ÷ 4 = 426,5
    // Treino: carb. 426,5 × 1,1 = 469,15 → 469; kcal 2945 + 42,65 × 4 = 3115,6 → 3116
    const p = { ...male, protein_basis: "lean_mass" as const };
    const m = { ...scale, leanMassKg: 65 };
    expect(goalsFromProfile(p, 80, false, ON, m)).toEqual({ kcal: 2945, protein: 163, carbs: 427, fat: 65 });
    expect(goalsFromProfile(p, 80, true, ON, m)).toEqual({ kcal: 3116, protein: 163, carbs: 469, fat: 65 });
  });
});
