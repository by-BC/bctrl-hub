import { describe, expect, it } from "vitest";
import { TEST_USER } from "../support/e2e-user";
import { signIn } from "../support/test-users";

// `supabase/seed.example.sql` (fictício) cria o usuário de E2E já com plano de treino,
// plano alimentar e hábitos do sistema. Rode `npx supabase db reset` para recarregar.
describe("seed de exemplo", () => {
  it("tem a mesma estrutura do plano real", async () => {
    const c = await signIn(TEST_USER.email, TEST_USER.password);

    const routines = await c.from("routines").select("id, name, position, rest_sec").order("position");
    expect(routines.data).toHaveLength(4);
    expect(routines.data?.every((r) => r.rest_sec === 120)).toBe(true);

    const items = await c.from("routine_exercises").select("exercise_id, sets");
    expect(items.data).toHaveLength(28);
    expect(new Set(items.data?.map((i) => i.exercise_id)).size).toBe(26);

    const meals = await c.from("meals").select("name, training_day_only, meal_options(title, items)");
    expect(meals.data).toHaveLength(6);
    expect(meals.data?.filter((m) => m.training_day_only)).toHaveLength(1);
    expect(meals.data?.every((m) => m.meal_options.length > 0)).toBe(true);
    const anyItem = meals.data?.[0].meal_options[0].items[0];
    expect(anyItem).toEqual({ name: expect.any(String), qty: expect.any(String), subs: expect.any(Array) });

    const habits = await c.from("habits").select("system_key").not("system_key", "is", null);
    expect(habits.data?.map((h) => h.system_key).sort()).toEqual(["abs", "cardio", "supplements"]);
  });
});
