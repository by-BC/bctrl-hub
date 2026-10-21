import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  deleteMealLog,
  deleteOffPlanItem,
  fetchOffPlanItems,
  upsertMealLog,
  upsertOffPlanItem,
  type MealLog,
} from "@/features/meals/api";
import { fetchFoods, upsertOwnFood } from "@/features/nutrition/api";
import { fetchProfile, upsertProfile, type ProfileSave } from "@/features/profile/api";
import type { Database } from "@/lib/database.types";
import { dayTotals, foodSnapshot, searchFoods, snapshotMacros } from "@/lib/domain/nutrition";
import { createTestUser, deleteTestUser, type TestUser } from "../support/test-users";

/**
 * Task 5.0 v2: perfil (cria e atualiza a mesma linha, RLS de dono) e itens fora do plano com
 * snapshot (editar o alimento depois não muda o dia; reenviar não duplica; outro usuário não vê).
 * Dados fictícios, usuários descartáveis no Supabase LOCAL.
 */

async function exec(op: PromiseLike<{ error: unknown }>) {
  const { error } = await op;
  if (error) throw new Error(JSON.stringify(error));
}

const DAY = "2026-10-15";

let owner: TestUser;
let other: TestUser;
let db: SupabaseClient<Database>;
let otherDb: SupabaseClient<Database>;

beforeAll(async () => {
  owner = await createTestUser("metas");
  other = await createTestUser("metas-outro");
  db = owner.client as SupabaseClient<Database>;
  otherDb = other.client as SupabaseClient<Database>;
});
afterAll(async () => {
  await deleteTestUser(owner);
  await deleteTestUser(other);
});

const profile: ProfileSave = {
  sex: "m",
  birth_date: "1996-05-10",
  height_cm: 180,
  activity_level: "moderate",
  goal: "maintain",
  protein_g_per_kg: 2,
  goal_overrides: { training: { carbs: 450 } },
  bmr_source: "auto",
  protein_basis: "weight",
  protein_g_per_kg_lean: 2.5,
};

describe("profiles via API", () => {
  it("sem linha, o perfil é null; salvar cria e salvar de novo atualiza a mesma linha", async () => {
    expect(await fetchProfile(db)).toBeNull();
    await upsertProfile(profile, db);
    await upsertProfile({ ...profile, goal: "gain", protein_g_per_kg: 1.8 }, db);
    expect(await fetchProfile(db)).toEqual({ ...profile, goal: "gain", protein_g_per_kg: 1.8 });
    const { count } = await db.from("profiles").select("user_id", { count: "exact", head: true });
    expect(count).toBe(1);
  });

  it("v3: fonte da TMB, base da proteína e g/kg de massa magra são gravados e lidos", async () => {
    await upsertProfile({ ...profile, bmr_source: "formula", protein_basis: "lean_mass", protein_g_per_kg_lean: 2.2 }, db);
    expect(await fetchProfile(db)).toMatchObject({ bmr_source: "formula", protein_basis: "lean_mass", protein_g_per_kg_lean: 2.2 });
    await upsertProfile({ ...profile, goal: "gain", protein_g_per_kg: 1.8 }, db);
  });

  it("outro usuário não lê o perfil e grava só o próprio", async () => {
    expect(await fetchProfile(otherDb)).toBeNull();
    await upsertProfile({ ...profile, sex: "f" }, otherDb);
    expect((await fetchProfile(otherDb))?.sex).toBe("f");
    expect((await fetchProfile(db))?.sex).toBe("m");
  });
});

describe("meal_log_items (fora do plano) via API", () => {
  const meal = crypto.randomUUID();
  const log: MealLog = { id: crypto.randomUUID(), day: DAY, meal_id: meal, option_id: null, off_plan: true, note: null };

  beforeAll(async () => {
    await exec(db.from("meals").insert({ id: meal, name: "Lanche", time: "16:00", position: 1 }));
  });

  it("grava o item com snapshot; reenviar não duplica; editar o alimento não muda o dia", async () => {
    const own = {
      id: crypto.randomUUID(),
      name: "Bolo de cenoura (fictício)",
      kcal: 300,
      protein_g: 5,
      carbs_g: 50,
      fat_g: 10,
      unit_grams: { un: 80 },
    };
    await upsertOwnFood(own, db);
    await upsertOwnFood(own, db); // idempotente
    const foods = await fetchFoods(db);
    expect(foods.filter((f) => f.id === own.id)).toHaveLength(1);
    const arroz = searchFoods(foods, "arroz integral cozido")[0];

    // Mesma sequência da gravação da fila (registro da refeição e depois o item), reenviada 2x.
    const rice = { id: crypto.randomUUID(), meal_log_id: log.id, food_id: arroz.id, name: arroz.name, grams: 150, ...foodSnapshot(arroz, 150) };
    for (let i = 0; i < 2; i++) {
      await upsertMealLog(log, db);
      await upsertOffPlanItem(rice, db);
    }
    const cake = { id: crypto.randomUUID(), meal_log_id: log.id, food_id: own.id, name: own.name, grams: 80, ...foodSnapshot(own, 80) };
    await upsertOffPlanItem(cake, db);

    let items = await fetchOffPlanItems(DAY, db);
    expect(items.map((i) => i.name)).toEqual(["Arroz, integral, cozido", "Bolo de cenoura (fictício)"]);
    expect(items[0]).toMatchObject({ meal_id: meal, grams: 150, kcal: 185.3, protein_g: 3.9, carbs_g: 38.7, fat_g: 1.5 });
    expect(Math.round(dayTotals({ options: [], offPlan: items.map(snapshotMacros) }).kcal)).toBe(425);

    // Editar o alimento depois não reescreve o dia.
    await exec(db.from("foods").update({ kcal: 999 }).eq("id", own.id));
    items = await fetchOffPlanItems(DAY, db);
    expect(items[1].kcal).toBe(240);

    // Outro dia não aparece; outro usuário não vê.
    expect(await fetchOffPlanItems("2026-10-16", db)).toEqual([]);
    expect(await fetchOffPlanItems(DAY, otherDb)).toEqual([]);

    // Remover um item; desmarcar a refeição apaga o resto (cascata).
    await deleteOffPlanItem(rice.id, db);
    expect((await fetchOffPlanItems(DAY, db)).map((i) => i.id)).toEqual([cake.id]);
    await deleteMealLog({ day: DAY, meal_id: meal }, db);
    expect(await fetchOffPlanItems(DAY, db)).toEqual([]);
  });

  it("outro usuário não grava item usando o alimento próprio alheio", async () => {
    const own = { id: crypto.randomUUID(), name: "Alimento privado", kcal: 100, protein_g: 1, carbs_g: 1, fat_g: 1, unit_grams: {} };
    await upsertOwnFood(own, db);
    const otherMeal = crypto.randomUUID();
    await exec(otherDb.from("meals").insert({ id: otherMeal, name: "Ceia", time: "22:00", position: 1 }));
    const otherLog: MealLog = { id: crypto.randomUUID(), day: DAY, meal_id: otherMeal, option_id: null, off_plan: true, note: null };
    await upsertMealLog(otherLog, otherDb);
    await expect(
      upsertOffPlanItem(
        { id: crypto.randomUUID(), meal_log_id: otherLog.id, food_id: own.id, name: "x", grams: 10, kcal: 10, protein_g: 0, carbs_g: 0, fat_g: 0 },
        otherDb,
      ),
    ).rejects.toThrow("Não foi possível adicionar o alimento.");
  });
});
