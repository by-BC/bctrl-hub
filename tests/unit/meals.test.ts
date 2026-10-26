import { describe, expect, it } from "vitest";
import {
  adherence,
  formatMealTime,
  hasWorkoutOn,
  mealStatus,
  orderMeals,
  selectedMealItems,
  visibleMeals,
  type PlanMeal,
} from "@/features/meals/domain/meals";
import { weekStart } from "@/lib/domain/week";

const meal = (id: string, time: string | null, position: number, training_day_only = false): PlanMeal => ({
  id,
  name: id,
  time,
  position,
  training_day_only,
});

// Mesma estrutura do plano: o pós-treino não tem horário e fica na posição 5.
const PLAN: PlanMeal[] = [
  meal("jantar", "19:30:00", 6),
  meal("cafe", "08:30:00", 2),
  meal("pos", null, 5, true),
  meal("acordar", "07:00:00", 1),
  meal("lanche", "16:00:00", 4),
  meal("almoco", "12:30:00", 3),
];
const ids = (meals: PlanMeal[]) => meals.map((m) => m.id);

describe("orderMeals", () => {
  it("ordena por horário e mantém a refeição sem horário na sua posição", () => {
    expect(ids(orderMeals(PLAN))).toEqual(["acordar", "cafe", "almoco", "lanche", "pos", "jantar"]);
  });

  it("horário vence a posição quando as duas discordam", () => {
    const meals = [meal("a", "20:00", 1), meal("b", "07:00", 2), meal("c", null, 3)];
    expect(ids(orderMeals(meals))).toEqual(["b", "a", "c"]);
  });
});

describe("visibleMeals", () => {
  it("sem treino, o pós-treino não aparece", () => {
    expect(ids(visibleMeals(PLAN, false))).toEqual(["acordar", "cafe", "almoco", "lanche", "jantar"]);
  });

  it("com treino, o pós-treino aparece entre o lanche e o jantar", () => {
    expect(ids(visibleMeals(PLAN, true))).toEqual(["acordar", "cafe", "almoco", "lanche", "pos", "jantar"]);
  });

  it("plano vazio", () => {
    expect(visibleMeals([], true)).toEqual([]);
  });
});

describe("adherence", () => {
  const log = (meal_id: string, off_plan = false) => ({ meal_id, option_id: off_plan ? null : "op", off_plan });

  it("0 refeições previstas: 0% sem dividir por zero", () => {
    expect(adherence([], [])).toEqual({ planned: 0, done: 0, offPlan: 0, logged: 0, pct: 0 });
  });

  it("nada registrado ainda", () => {
    expect(adherence([], visibleMeals(PLAN, false))).toMatchObject({ planned: 5, done: 0, pct: 0 });
  });

  it("todas feitas no plano: 100%", () => {
    const visible = visibleMeals(PLAN, true);
    expect(adherence(visible.map((m) => log(m.id)), visible)).toEqual({
      planned: 6,
      done: 6,
      offPlan: 0,
      logged: 6,
      pct: 100,
    });
  });

  it("fora do plano conta como registrada, mas não como aderente", () => {
    const visible = visibleMeals(PLAN, false);
    const result = adherence([log("cafe"), log("almoco"), log("jantar", true)], visible);
    expect(result).toEqual({ planned: 5, done: 2, offPlan: 1, logged: 3, pct: 40 });
  });

  it("pós-treino registrado em dia sem treino não conta", () => {
    const visible = visibleMeals(PLAN, false);
    const result = adherence([log("cafe"), log("pos")], visible);
    expect(result).toEqual({ planned: 5, done: 1, offPlan: 0, logged: 1, pct: 20 });
  });

  it("arredonda o percentual", () => {
    const visible = visibleMeals(PLAN, true); // 6 previstas
    expect(adherence([log("cafe")], visible).pct).toBe(17);
  });
});

describe("mealStatus", () => {
  it("pendente, feita e fora do plano", () => {
    expect(mealStatus(undefined)).toBe("pending");
    expect(mealStatus({ meal_id: "a", option_id: "op", off_plan: false })).toBe("done");
    expect(mealStatus({ meal_id: "a", option_id: null, off_plan: true })).toBe("off_plan");
  });
});

describe("selectedMealItems", () => {
  const items = ["arroz", "feijão", "frango"];

  it("mantém todos os itens nos registros antigos e na escolha da opção completa", () => {
    expect(selectedMealItems(items, null)).toEqual(items);
    expect(selectedMealItems(items, undefined)).toEqual(items);
  });

  it("mantém apenas os índices escolhidos, na ordem do plano", () => {
    expect(selectedMealItems(items, [2, 0, 2, 99, -1])).toEqual(["arroz", "frango"]);
  });
});

describe("hasWorkoutOn", () => {
  it("treino finalizado no dia", () => {
    expect(hasWorkoutOn("2026-10-19", { activeStartedAt: null, finishedDays: ["2026-10-19"] })).toBe(true);
    expect(hasWorkoutOn("2026-10-18", { activeStartedAt: null, finishedDays: ["2026-10-19"] })).toBe(false);
  });

  it("sessão ativa conta no dia de São Paulo em que começou", () => {
    // 01:30 UTC do dia 20 = 22:30 do dia 19 em São Paulo.
    const startedAt = "2026-10-20T01:30:00Z";
    expect(hasWorkoutOn("2026-10-19", { activeStartedAt: startedAt, finishedDays: [] })).toBe(true);
    expect(hasWorkoutOn("2026-10-20", { activeStartedAt: startedAt, finishedDays: [] })).toBe(false);
  });
});

describe("formatMealTime", () => {
  it("corta os segundos", () => {
    expect(formatMealTime("08:30:00")).toBe("08:30");
    expect(formatMealTime(null)).toBeNull();
  });
});

describe("weekStart", () => {
  it("domingo é o início; sábado pertence à mesma semana", () => {
    expect(weekStart("2026-10-18")).toBe("2026-10-18"); // domingo
    expect(weekStart("2026-10-22")).toBe("2026-10-18"); // quinta
    expect(weekStart("2026-10-24")).toBe("2026-10-18"); // sábado
    expect(weekStart("2026-10-25")).toBe("2026-10-25"); // domingo seguinte
  });

  it("atravessa mês e ano", () => {
    expect(weekStart("2026-11-01")).toBe("2026-11-01");
    expect(weekStart("2027-01-01")).toBe("2026-12-27");
  });
});
