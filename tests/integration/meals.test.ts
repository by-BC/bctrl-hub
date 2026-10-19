import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  deleteMealLog,
  fetchHasFinishedWorkout,
  fetchMealLogs,
  fetchMealPlan,
  updateMealOption,
  upsertMealLog,
  type MealLog,
} from "@/features/meals/api";
import { fetchWeekSummary } from "@/features/week/api";
import type { Database } from "@/lib/database.types";
import { createTestUser, deleteTestUser, type TestUser } from "../support/test-users";

async function exec(op: PromiseLike<{ error: unknown }>) {
  const { error } = await op;
  if (error) throw new Error(JSON.stringify(error));
}

const DAY = "2026-10-14"; // quarta; semana de 2026-10-12

describe("refeições: registro idempotente e plano", () => {
  let owner: TestUser;
  let other: TestUser;
  let db: SupabaseClient<Database>;
  let otherDb: SupabaseClient<Database>;
  const cafe = crypto.randomUUID();
  const pos = crypto.randomUUID();
  const op1 = crypto.randomUUID();
  const op2 = crypto.randomUUID();

  const log = (patch: Partial<MealLog>): MealLog => ({
    id: crypto.randomUUID(),
    day: DAY,
    meal_id: cafe,
    option_id: op1,
    off_plan: false,
    note: null,
    ...patch,
  });

  beforeAll(async () => {
    owner = await createTestUser("refeicoes");
    other = await createTestUser("refeicoes-outro");
    db = owner.client as unknown as SupabaseClient<Database>;
    otherDb = other.client as unknown as SupabaseClient<Database>;
    await exec(
      db.from("meals").insert([
        { id: cafe, name: "Café da manhã", time: "08:30", position: 1, training_day_only: false },
        { id: pos, name: "Pós-treino", time: null, position: 2, training_day_only: true },
      ]),
    );
    await exec(
      db.from("meal_options").insert([
        { id: op1, meal_id: cafe, position: 1, title: "Tapioca", items: [{ name: "Tapioca", qty: "40 g", subs: ["Cuscuz 60 g"] }] },
        { id: op2, meal_id: cafe, position: 2, title: "Iogurte", items: [{ name: "Iogurte", qty: "170 g", subs: [] }] },
      ]),
    );
  });

  afterAll(async () => {
    await deleteTestUser(owner);
    await deleteTestUser(other);
  });

  it("lê o plano com as opções em ordem e os itens no formato {name, qty, subs}", async () => {
    const plan = await fetchMealPlan(db);
    expect(plan.map((m) => m.name)).toEqual(["Café da manhã", "Pós-treino"]);
    expect(plan[0].meal_options.map((o) => o.title)).toEqual(["Tapioca", "Iogurte"]);
    expect(plan[0].meal_options[0].items).toEqual([{ name: "Tapioca", qty: "40 g", subs: ["Cuscuz 60 g"] }]);
  });

  it("upsert não duplica: reenviar e trocar a opção atualiza o mesmo registro", async () => {
    const first = log({ option_id: op1 });
    await upsertMealLog(first, db);
    await upsertMealLog(first, db); // reenvio idêntico (fila offline)
    // Outro aparelho/aba, sem saber do id: a chave natural (dia + refeição) manda.
    await upsertMealLog(log({ option_id: op2 }), db);

    const logs = await fetchMealLogs(DAY, db);
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ meal_id: cafe, option_id: op2, off_plan: false, note: null });
  });

  it("fora do plano grava a nota e não conta como feita na semana", async () => {
    const before = await fetchWeekSummary("2026-10-12", db);
    expect(before.meals.done).toBe(1); // café no plano (pós-treino só em dia de treino)

    const [current] = await fetchMealLogs(DAY, db);
    await upsertMealLog({ ...current, option_id: null, off_plan: true, note: "Pizza" }, db);
    const logs = await fetchMealLogs(DAY, db);
    expect(logs).toEqual([expect.objectContaining({ off_plan: true, option_id: null, note: "Pizza" })]);

    const after = await fetchWeekSummary("2026-10-12", db);
    expect(after.meals.done).toBe(0);
    expect(after.meals.planned).toBe(7); // 1 refeição diária × 7 dias, sem treino
  });

  it("treino finalizado no dia libera o pós-treino", async () => {
    expect(await fetchHasFinishedWorkout(DAY, db)).toBe(false);
    await exec(
      db.from("workouts").insert({
        day: DAY,
        started_at: `${DAY}T13:00:00Z`,
        finished_at: `${DAY}T14:00:00Z`,
      }),
    );
    expect(await fetchHasFinishedWorkout(DAY, db)).toBe(true);
    expect((await fetchWeekSummary("2026-10-12", db)).meals.planned).toBe(8);
  });

  it("editar a opção reflete na leitura do plano", async () => {
    await updateMealOption(op2, { title: "Iogurte com fruta", items: [{ name: "Iogurte", qty: "200 g", subs: ["Kefir 200 g"] }] }, db);
    const plan = await fetchMealPlan(db);
    expect(plan[0].meal_options[1]).toMatchObject({
      title: "Iogurte com fruta",
      items: [{ name: "Iogurte", qty: "200 g", subs: ["Kefir 200 g"] }],
    });
  });

  it("desmarcar apaga o registro do dia", async () => {
    await deleteMealLog({ day: DAY, meal_id: cafe }, db);
    expect(await fetchMealLogs(DAY, db)).toEqual([]);
  });

  describe("RLS", () => {
    it("outro usuário não vê o plano nem os registros", async () => {
      await upsertMealLog(log({ option_id: op1 }), db);
      expect(await fetchMealPlan(otherDb)).toEqual([]);
      expect(await fetchMealLogs(DAY, otherDb)).toEqual([]);
    });

    it("outro usuário não registra refeição do dono nem sobrescreve o registro dele", async () => {
      await expect(upsertMealLog(log({ option_id: op2 }), otherDb)).rejects.toThrow();
      const logs = await fetchMealLogs(DAY, db);
      expect(logs).toHaveLength(1);
      expect(logs[0].option_id).toBe(op1);
    });

    it("outro usuário não apaga o registro do dono", async () => {
      await deleteMealLog({ day: DAY, meal_id: cafe }, otherDb); // sem erro: RLS só filtra
      expect(await fetchMealLogs(DAY, db)).toHaveLength(1);
    });
  });
});
