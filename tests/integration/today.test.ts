import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { hexWeekView } from "@/features/today/hex-week";
import { fetchWeekSummary } from "@/features/week/api";
import type { Database } from "@/lib/database.types";
import { createTestUser, deleteTestUser, type TestUser } from "../support/test-users";

/**
 * Painel Hoje: uma semana semeada (segunda 12/10 a domingo 18/10) e os números que o
 * Hex Week mostra, calculados a partir do `week_summary` do banco.
 */
const WEEK = "2026-10-12";

async function exec(op: PromiseLike<{ error: unknown }>) {
  const { error } = await op;
  if (error) throw new Error(JSON.stringify(error));
}

describe("week_summary → Hex Week", () => {
  let user: TestUser;
  let db: SupabaseClient<Database>;
  const id = () => crypto.randomUUID();
  const meal = { cafe: id(), almoco: id(), pos: id() };
  const habit = { cardio: id(), abs: id(), supplements: id() };

  beforeAll(async () => {
    user = await createTestUser("hoje");
    db = user.client as unknown as SupabaseClient<Database>;

    // 2 treinos finalizados: segunda e quarta.
    const workout = (day: string) => ({
      id: id(),
      day,
      started_at: `${day}T13:00:00Z`,
      finished_at: `${day}T14:00:00Z`,
    });
    await exec(db.from("workouts").insert([workout("2026-10-12"), workout("2026-10-14")]));

    // 2 refeições diárias + pós-treino (só em dia de treino): 2 × 7 + 1 × 2 = 16 previstas.
    await exec(
      db.from("meals").insert([
        { id: meal.cafe, name: "Café", time: "08:30", position: 1, training_day_only: false },
        { id: meal.almoco, name: "Almoço", time: "12:30", position: 2, training_day_only: false },
        { id: meal.pos, name: "Pós-treino", time: null, position: 3, training_day_only: true },
      ]),
    );
    const mealLog = (meal_id: string, day: string, off_plan = false) => ({
      id: id(),
      meal_id,
      day,
      option_id: null,
      off_plan,
      note: off_plan ? "pizza" : null,
    });
    await exec(
      db.from("meal_logs").insert([
        mealLog(meal.cafe, "2026-10-12"),
        mealLog(meal.cafe, "2026-10-13"),
        mealLog(meal.cafe, "2026-10-14"),
        mealLog(meal.almoco, "2026-10-12"),
        mealLog(meal.pos, "2026-10-12"), // dia de treino: conta
        mealLog(meal.pos, "2026-10-13"), // sem treino: não conta
        mealLog(meal.almoco, "2026-10-15", true), // fora do plano: não conta
        mealLog(meal.cafe, "2026-10-19"), // semana seguinte
      ]),
    );

    await exec(
      db.from("habits").insert([
        { id: habit.cardio, name: "Cardio", kind: "cardio", period: "week", target: 150, unit: "min", system_key: "cardio" },
        { id: habit.abs, name: "Abdominal", kind: "check", period: "week", target: 3, system_key: "abs" },
        { id: habit.supplements, name: "Suplementos", kind: "check", period: "day", target: 1, system_key: "supplements" },
      ]),
    );
    const habitLog = (habit_id: string, day: string, value = 1) => ({ id: id(), habit_id, day, value });
    await exec(
      db.from("habit_logs").insert([
        habitLog(habit.cardio, "2026-10-12", 45),
        habitLog(habit.cardio, "2026-10-16", 30),
        habitLog(habit.abs, "2026-10-12"),
        habitLog(habit.abs, "2026-10-14"),
        habitLog(habit.supplements, "2026-10-12"),
        habitLog(habit.supplements, "2026-10-13"),
        habitLog(habit.supplements, "2026-10-14"),
        habitLog(habit.supplements, "2026-10-11"), // semana anterior
      ]),
    );
  });

  afterAll(async () => {
    await deleteTestUser(user);
  });

  it("devolve os números da semana que o painel exibe", async () => {
    const summary = await fetchWeekSummary(WEEK, db);
    expect(summary.workouts).toEqual({ done: 2, target: 4 });
    expect(summary.meals).toEqual({ planned: 16, done: 5, pct: 31 });
    expect(summary.cardio).toMatchObject({ minutes: 75, target: 150 });
    expect(summary.abs).toEqual({ done: 2, target: 3 });
    expect(summary.supplements).toEqual({ done: 3, target: 7 });

    const view = hexWeekView(summary);
    // 2/4 treinos: o segmento azul fica pela metade.
    expect(view.workouts).toMatchObject({ progress: 0.5, value: "2/4" });
    expect(view.meals).toMatchObject({ progress: 0.31, value: "31%", detail: "5 de 16 refeições no plano" });
    // Hábitos: média de 75/150, 2/3 e 3/7.
    expect(view.habits.progress).toBeCloseTo((0.5 + 2 / 3 + 3 / 7) / 3, 6);
    expect(view.habits).toMatchObject({ value: "53%", detail: "Cardio 75/150 min · Abdominal 2/3 · Suplementos 3/7" });
    expect(view.empty).toBe(false);
  });

  it("semana sem registros: tudo em 0 e o painel mostra o estado vazio", async () => {
    const view = hexWeekView(await fetchWeekSummary("2026-11-02", db));
    expect([view.workouts.progress, view.meals.progress, view.habits.progress]).toEqual([0, 0, 0]);
    expect(view.workouts.value).toBe("0/4");
    expect(view.empty).toBe(true);
  });
});
