import { execSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { fetchMealPlan, updateMealOption } from "@/features/meals/api";
import { fetchFoods } from "@/features/nutrition/api";
import type { Database } from "@/lib/database.types";
import { optionMacros, roundMacros, searchFoods } from "@/lib/domain/nutrition";
import { buildLinkSql, planLinks, type SeedOption } from "../../scripts/meals/link";
import { parseTacoMigration } from "../../scripts/taco/taco";
import { adminClient, createTestUser, deleteTestUser, type TestUser } from "../support/test-users";

/**
 * Nutrição (task 4.0 v2): a TACO carregada pela migration é lida por qualquer usuário via RLS,
 * os campos novos dos itens do plano são gravados e lidos, e o SQL de auto-vínculo (gerado a
 * partir de um plano FICTÍCIO) aplicado duas vezes no Supabase LOCAL não muda nada na 2ª vez.
 */

async function exec(op: PromiseLike<{ error: unknown }>) {
  const { error } = await op;
  if (error) throw new Error(JSON.stringify(error));
}

const tacoFromMigration = () => {
  const dir = join(process.cwd(), "supabase/migrations");
  const file = readdirSync(dir).find((f) => f.endsWith("_foods_taco.sql"))!;
  return parseTacoMigration(readFileSync(join(dir, file), "utf8"));
};

let user: TestUser;
let db: SupabaseClient<Database>;

beforeAll(async () => {
  user = await createTestUser("nutricao");
  db = user.client as SupabaseClient<Database>;
});
afterAll(async () => {
  await deleteTestUser(user);
});

describe("TACO via RLS", () => {
  it("usuário comum lê os 597 alimentos da TACO e acha o arroz integral sem acento", async () => {
    const foods = await fetchFoods(db);
    const taco = foods.filter((f) => f.taco_id !== null && f.taco_id! <= 597);
    expect(taco).toHaveLength(597);
    const [arroz] = searchFoods(foods, "arroz integral cozido");
    expect(arroz.name).toBe("Arroz, integral, cozido");
    const m = roundMacros({
      kcal: (arroz.kcal * 150) / 100,
      protein: (arroz.protein_g * 150) / 100,
      carbs: (arroz.carbs_g * 150) / 100,
      fat: (arroz.fat_g * 150) / 100,
    });
    expect(m).toEqual({ kcal: 185, protein: 3.9, carbs: 38.7, fat: 1.5 });
    expect(searchFoods(foods, "PAO frances")[0]?.name).toBe("Pão, trigo, francês");
  });

  it("usuário comum não altera nem apaga a TACO", async () => {
    const upd = await db.from("foods").update({ kcal: 1 }).eq("taco_id", 1).select();
    expect(upd.data ?? []).toEqual([]);
    const del = await db.from("foods").delete().eq("taco_id", 1).select();
    expect(del.data ?? []).toEqual([]);
    const { data } = await adminClient().from("foods").select("kcal").eq("taco_id", 1).single();
    expect(Number(data!.kcal)).toBeCloseTo(123.53);
  });
});

describe("itens do plano com food_id, grams, macros_override e free", () => {
  const meal = crypto.randomUUID();
  const option = crypto.randomUUID();

  beforeAll(async () => {
    await exec(db.from("meals").insert({ id: meal, name: "Almoço teste", position: 1 }));
    await exec(
      db.from("meal_options").insert({
        id: option,
        meal_id: meal,
        position: 1,
        title: "Prato",
        items: [{ name: "Arroz", qty: "150 g", subs: [] }],
      }),
    );
  });

  it("grava os campos novos e o cálculo da opção usa a TACO", async () => {
    const foods = await fetchFoods(db);
    const arroz = foods.find((f) => f.taco_id === 1)!;
    await updateMealOption(
      option,
      {
        items: [
          { name: "Arroz", qty: "150 g", subs: [], food_id: arroz.id, grams: 150 },
          { name: "Salada", qty: "à vontade", subs: [], free: true },
          { name: "Suplemento", qty: "30 g", subs: [], macros_override: { kcal: 120, protein: 24, carbs: 3, fat: 1 } },
          { name: "Molho", qty: "20 g", subs: [] },
        ],
      },
      db,
    );
    const plan = await fetchMealPlan(db);
    const items = plan.find((m) => m.id === meal)!.meal_options[0].items;
    expect(items[0]).toMatchObject({ food_id: arroz.id, grams: 150 });
    expect(items[1]).toMatchObject({ free: true });
    const { total, unresolved } = optionMacros(items, new Map(foods.map((f) => [f.id, f])));
    expect(unresolved).toBe(1);
    expect(roundMacros(total)).toEqual({ kcal: 305, protein: 27.9, carbs: 41.7, fat: 2.5 });
  });
});

describe("SQL de auto-vínculo (plano fictício)", () => {
  let dir: string;
  let sqlFile: string;
  const meal = crypto.randomUUID();
  const opA = crypto.randomUUID();
  const opB = crypto.randomUUID();
  const manualFood = "11111111-2222-4333-8444-555555555555";

  const options: SeedOption[] = [
    {
      meal: "Refeição fictícia",
      position: 1,
      title: "A",
      items: [
        { name: "Arroz branco cozido", qty: "120 g" },
        { name: "Ovo", qty: "2 un (100 g)" },
        { name: "Folhas verdes", qty: "à vontade" },
        { name: "Suplemento X", qty: "30 g" },
      ],
    },
    {
      meal: "Refeição fictícia",
      position: 2,
      title: "B",
      items: [{ name: "Água", qty: "300 ml" }, { name: "Banana", qty: "80 g" }, { name: "Molho secreto", qty: "15 g" }],
    },
  ];

  function applySql() {
    // Caminho gerado por mkdtemp (sem entrada externa).
    return execSync(`npx supabase db query --local -f "${sqlFile}"`, { stdio: ["ignore", "pipe", "pipe"] }).toString();
  }

  async function readItems(id: string) {
    const { data } = await adminClient().from("meal_options").select("items").eq("id", id).single();
    return data!.items as Record<string, unknown>[];
  }

  beforeAll(async () => {
    await exec(db.from("meals").insert({ id: meal, name: "Refeição fictícia", position: 2 }));
    await exec(
      db.from("meal_options").insert([
        // O ovo já foi vinculado à mão no app: o SQL não pode sobrescrever.
        {
          id: opA,
          meal_id: meal,
          position: 1,
          title: "A",
          items: [
            { name: "Arroz branco cozido", qty: "120 g", subs: ["Arroz integral 120 g"] },
            { name: "Ovo", qty: "2 un (100 g)", subs: [], food_id: manualFood, grams: 90 },
            { name: "Folhas verdes", qty: "à vontade", subs: [] },
            { name: "Suplemento X", qty: "30 g", subs: [] },
          ],
        },
        {
          id: opB,
          meal_id: meal,
          position: 2,
          title: "B",
          items: [
            { name: "Água", qty: "300 ml", subs: [] },
            { name: "Banana", qty: "80 g", subs: [] },
            { name: "Molho secreto", qty: "15 g", subs: [] },
          ],
        },
      ]),
    );
    // Suplemento X vira alimento próprio do usuário (valores fictícios por 100 g).
    const plan = planLinks(options, tacoFromMigration(), { "Suplemento X": "own:suplemento-x" }, [
      { key: "suplemento-x", name: "Suplemento X (fictício)", kcal: 400, protein_g: 80, carbs_g: 8, fat_g: 5 },
    ]);
    dir = mkdtempSync(join(tmpdir(), "bctrl-meal-link-"));
    sqlFile = join(dir, "meal-items.sql");
    writeFileSync(sqlFile, buildLinkSql({ ownerEmail: user.email, plan }));
  });

  afterAll(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it("vincula por nome + quantidade, mantém o vínculo manual e é idempotente", async () => {
    applySql();
    const a1 = await readItems(opA);
    const b1 = await readItems(opB);

    const tacoId = async (n: number) =>
      (await adminClient().from("foods").select("id").eq("taco_id", n).single()).data!.id as string;
    expect(a1[0]).toMatchObject({ name: "Arroz branco cozido", food_id: await tacoId(3), grams: 120, subs: ["Arroz integral 120 g"] });
    expect(a1[1]).toMatchObject({ food_id: manualFood, grams: 90 }); // manual vence
    expect(a1[2]).toMatchObject({ free: true, grams: 0 });
    const ownFoods = async () =>
      (await adminClient().from("foods").select("id, name, kcal, protein_g").eq("user_id", user.id)).data!;
    const [own] = await ownFoods();
    expect(own).toMatchObject({ name: "Suplemento X (fictício)", kcal: 400, protein_g: 80 });
    expect(a1[3]).toMatchObject({ name: "Suplemento X", food_id: own.id, grams: 30 });
    expect(b1[0]).toMatchObject({ name: "Água", free: true });
    expect(b1[1]).toMatchObject({ food_id: await tacoId(182), grams: 80 });
    expect(b1[2]).toEqual({ name: "Molho secreto", qty: "15 g", subs: [] }); // pendente: intocado

    // O próprio dono lê o alimento próprio pelo RLS e o cálculo da opção A fecha: arroz 120 g + suplemento 30 g.
    const foods = await fetchFoods(db);
    const { total, unresolved } = optionMacros(a1 as never, new Map(foods.map((f) => [f.id, f])));
    expect(unresolved).toBe(1); // o ovo aponta para um alimento manual que não existe
    // arroz 128,26 × 1,2 = 153,9 + suplemento 400 × 0,3 = 120 (o ovo fica sem valor)
    expect(roundMacros(total).kcal).toBe(Math.round(128.26 * 1.2 + 120));

    applySql();
    expect(await readItems(opA)).toEqual(a1);
    expect(await readItems(opB)).toEqual(b1);
    expect(await ownFoods()).toHaveLength(1);
  });

  it("não toca no plano de outro usuário", async () => {
    const other = await createTestUser("nutricao-outro");
    try {
      const m = crypto.randomUUID();
      const o = crypto.randomUUID();
      await exec(other.client.from("meals").insert({ id: m, name: "Outra", position: 1 }));
      await exec(
        other.client.from("meal_options").insert({ id: o, meal_id: m, position: 1, title: "X", items: [{ name: "Banana", qty: "80 g", subs: [] }] }),
      );
      applySql();
      expect(await readItems(o)).toEqual([{ name: "Banana", qty: "80 g", subs: [] }]);
    } finally {
      await deleteTestUser(other);
    }
  });
});
