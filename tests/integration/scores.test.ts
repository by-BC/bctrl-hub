import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { fetchDailyScores, fetchMonthSummary } from "@/features/profile/api";
import type { Database } from "@/lib/database.types";
import { dayInSaoPaulo } from "@/lib/domain/day";
import { monthNutrition, type PlanItem } from "@/features/nutrition/domain/nutrition";
import { addDays } from "@/lib/domain/stats";
import { anonClient, createTestUser, deleteTestUser, type TestUser } from "../support/test-users";

/**
 * Task 6.0 v2: `daily_scores` e `month_summary` com dados semeados à mão (usuário descartável,
 * Supabase LOCAL). A semana de 07 a 13/09/2026 tem um score esperado por dia; agosto e setembro
 * têm números calculados à mão. Datas de "dia" em America/Sao_Paulo (UTC−3).
 */

async function exec(op: PromiseLike<{ error: unknown }>) {
  const { error } = await op;
  if (error) throw new Error(JSON.stringify(error));
}

let owner: TestUser;
let db: SupabaseClient<Database>;

const ids = {
  supino: crypto.randomUUID(),
  cafe: crypto.randomUUID(),
  almoco: crypto.randomUUID(),
  jantar: crypto.randomUUID(),
  lanche: crypto.randomUUID(),
  pos: crypto.randomUUID(),
  creatina: crypto.randomUUID(),
  agua: crypto.randomUUID(),
  leitura: crypto.randomUUID(),
  novo: crypto.randomUUID(),
  cardio: crypto.randomUUID(),
  abs: crypto.randomUUID(),
};
/** Opção única de cada refeição (id da refeição → id da opção). */
const option: Record<string, string> = {};

/** Treino com séries [kg, reps, set_type, pr_kinds] num só exercício (supino). */
async function workout(
  day: string,
  sets: [number, number, string?, string[]?][],
  opts: { startedAt?: string; finished?: boolean; hevy?: boolean } = {},
) {
  const id = crypto.randomUUID();
  const startedAt = opts.startedAt ?? `${day}T13:00:00Z`;
  await exec(
    db.from("workouts").insert({
      id,
      started_at: startedAt,
      finished_at: opts.finished === false ? null : new Date(Date.parse(startedAt) + 3_600_000).toISOString(),
      day,
      ...(opts.hevy ? { source: "hevy", hevy_workout_id: `hevy-${id}` } : {}),
    }),
  );
  const we = crypto.randomUUID();
  await exec(db.from("workout_exercises").insert({ id: we, workout_id: id, exercise_id: ids.supino, position: 1 }));
  await exec(
    db.from("workout_sets").insert(
      sets.map(([weight_kg, reps, set_type = "normal", pr_kinds = []], i) => ({
        workout_exercise_id: we,
        position: i + 1,
        weight_kg,
        reps,
        set_type,
        pr_kinds,
      })),
    ),
  );
}

async function meals(day: string, mealIds: string[], offPlan = false) {
  await exec(
    db.from("meal_logs").insert(
      mealIds.map((meal_id) => ({
        day,
        meal_id,
        option_id: offPlan ? null : option[meal_id],
        off_plan: offPlan,
      })),
    ),
  );
}

async function habit(habit_id: string, day: string, value = 1, extra: Record<string, unknown> = {}) {
  await exec(db.from("habit_logs").insert({ habit_id, day, value, ...extra }));
}

async function task(doneAt: string | null) {
  await exec(db.from("tasks").insert({ title: "Tarefa", done_at: doneAt }));
}

const macros = (kcal: number, protein: number) => ({ kcal, protein, carbs: 0, fat: 0 });

beforeAll(async () => {
  owner = await createTestUser("scores");
  db = owner.client as SupabaseClient<Database>;

  await exec(db.from("exercises").insert({ id: ids.supino, name: "Supino reto" }));

  // Plano: 4 refeições diárias + pós-treino (só em dia de treino), uma opção cada.
  const plan: [string, string, boolean, number, number][] = [
    [ids.cafe, "Café", false, 300, 20],
    [ids.almoco, "Almoço", false, 600, 40],
    [ids.jantar, "Jantar", false, 700, 45],
    [ids.lanche, "Lanche", false, 200, 15],
    [ids.pos, "Pós-treino", true, 250, 30],
  ];
  await exec(
    db.from("meals").insert(plan.map(([id, name, training_day_only], i) => ({ id, name, training_day_only, position: i + 1 }))),
  );
  for (const [meal_id, name, , kcal, protein] of plan) {
    option[meal_id] = crypto.randomUUID();
    const items: PlanItem[] = [{ name, qty: "1 un", macros_override: macros(kcal, protein) }];
    await exec(db.from("meal_options").insert({ id: option[meal_id], meal_id, position: 1, title: "Opção 1", items }));
  }

  // Hábitos diários: creatina (check), água (3 copos), leitura (arquivada no sábado 12/09)
  // e um criado no domingo 13/09 (não vale antes). Cardio e abdominal são semanais.
  await exec(
    db.from("habits").insert([
      { id: ids.creatina, name: "Creatina", kind: "check", period: "day", target: 1, created_at: "2026-08-01T12:00:00Z" },
      { id: ids.agua, name: "Água", kind: "quantity", period: "day", target: 3, created_at: "2026-08-01T12:00:00Z" },
      {
        id: ids.leitura,
        name: "Leitura",
        kind: "check",
        period: "day",
        target: 1,
        created_at: "2026-08-01T12:00:00Z",
        archived_at: "2026-09-12T12:00:00Z",
      },
      { id: ids.novo, name: "Novo", kind: "check", period: "day", target: 1, created_at: "2026-09-13T12:00:00Z" },
      { id: ids.cardio, name: "Cardio", kind: "cardio", period: "week", target: 150, system_key: "cardio" },
      { id: ids.abs, name: "Abdominal", kind: "check", period: "week", target: 3, system_key: "abs" },
    ], { defaultToNull: false }),
  );

  // Composicao corporal: uma medicao no mes anterior e duas no mes consultado.
  // A ultima fica em 30/09 23h30 de Sao Paulo (01/10 UTC), cobrindo a virada de mes.
  await exec(
    db.from("body_measurements").insert([
      {
        id: crypto.randomUUID(), measured_at: "2026-08-31T10:00:00-03:00", day: "2026-08-31",
        weight_kg: 82, body_fat_pct: 22, skeletal_muscle_kg: 34, source: "manual",
      },
      {
        id: crypto.randomUUID(), measured_at: "2026-09-01T07:00:00-03:00", day: "2026-09-01",
        weight_kg: 81.5, body_fat_pct: 21.5, skeletal_muscle_kg: 34.2, source: "manual",
      },
      {
        id: crypto.randomUUID(), measured_at: "2026-09-30T23:30:00-03:00", day: "2026-09-30",
        weight_kg: 80, body_fat_pct: 20.5, skeletal_muscle_kg: 35, source: "manual",
      },
    ], { defaultToNull: false }),
  );

  // ── Agosto ──
  // Treino de 31/08 às 23h30 em São Paulo (01/09 02h30 UTC): é de agosto.
  await workout("2026-08-31", [[80, 10, "normal", ["weight"]]], { startedAt: "2026-09-01T02:30:00Z", hevy: true });
  await habit(ids.cardio, "2026-08-20", 30, { distance_km: 4.5, cardio_type: "run" });
  await task("2026-09-01T02:30:00Z"); // 31/08 23h30 em São Paulo
  await habit(ids.abs, "2026-08-31");

  // ── Semana de 07/09 (segunda) a 13/09 (domingo) ──
  // Seg 07: treino (importado do Hevy) + 5/5 refeições + hábitos + tarefa → 4.
  await workout("2026-09-07", [[40, 10, "warmup"], [100, 10, "normal", ["weight", "e1rm"]]], { hevy: true });
  await meals("2026-09-07", [ids.cafe, ids.almoco, ids.jantar, ids.lanche, ids.pos]);
  await habit(ids.creatina, "2026-09-07");
  await habit(ids.agua, "2026-09-07", 3);
  await habit(ids.leitura, "2026-09-07");
  await task("2026-09-07T15:00:00Z");

  // Ter 08: só cardio → treinou. Pós-treino registrado sem treino não conta: 3/4 = 75% → sem dieta.
  // Hábitos incompletos (água 2/3) → 1.
  await habit(ids.cardio, "2026-09-08", 40, { distance_km: 6.2, cardio_type: "treadmill" });
  await meals("2026-09-08", [ids.cafe, ids.almoco, ids.jantar, ids.pos]);
  await habit(ids.creatina, "2026-09-08");
  await habit(ids.agua, "2026-09-08", 2);
  await habit(ids.leitura, "2026-09-08");

  // Qua 09: 4/4 refeições + hábitos (água 1 + 2) + tarefa às 23h30 (10/09 02h30 UTC) → 3.
  await meals("2026-09-09", [ids.cafe, ids.almoco, ids.jantar, ids.lanche]);
  await habit(ids.creatina, "2026-09-09");
  await habit(ids.agua, "2026-09-09", 1);
  await habit(ids.agua, "2026-09-09", 2);
  await habit(ids.leitura, "2026-09-09");
  await task("2026-09-10T02:30:00Z");

  // Qui 10: treino não finalizado, refeições fora do plano, tarefa em aberto → 0.
  await workout("2026-09-10", [[70, 10]], { finished: false });
  await meals("2026-09-10", [ids.cafe, ids.almoco, ids.jantar, ids.lanche], true);
  const { data: offLog } = await db
    .from("meal_logs")
    .select("id")
    .eq("day", "2026-09-10")
    .eq("meal_id", ids.almoco)
    .single();
  await exec(
    db.from("meal_log_items").insert({
      meal_log_id: offLog!.id,
      name: "Arroz, integral, cozido",
      grams: 150,
      kcal: 185,
      protein_g: 3.9,
      carbs_g: 38.6,
      fat_g: 1.5,
    }),
  );
  await task(null);

  // Sex 11: dois treinos (1.080 kg e 200 kg) + 4/5 refeições (80%, no limite) → 2.
  await workout("2026-09-11", [[60, 10], [60, 8]]);
  await workout("2026-09-11", [[50, 4]], { startedAt: "2026-09-11T20:00:00Z" });
  await meals("2026-09-11", [ids.cafe, ids.almoco, ids.jantar, ids.lanche]);

  // Sáb 12: leitura arquivada hoje, então só creatina e água contam → hábitos ok → 1.
  await habit(ids.creatina, "2026-09-12");
  await habit(ids.agua, "2026-09-12", 3);

  // Dom 13: "Novo" passa a valer e não foi feito → 0.
  await habit(ids.creatina, "2026-09-13");
  await habit(ids.agua, "2026-09-13", 3);
});

afterAll(async () => {
  await deleteTestUser(owner);
});

describe("daily_scores", () => {
  it("semana semeada à mão: cada critério isolado e combinado", async () => {
    const rows = await fetchDailyScores("2026-09-07", "2026-09-13", db);
    expect(rows.map((r) => [r.day, r.trained, r.diet, r.habits, r.tasks, r.score])).toEqual([
      ["2026-09-07", true, true, true, true, 4],
      ["2026-09-08", true, false, false, false, 1],
      ["2026-09-09", false, true, true, true, 3],
      ["2026-09-10", false, false, false, false, 0],
      ["2026-09-11", true, true, false, false, 2],
      ["2026-09-12", false, false, true, false, 1],
      ["2026-09-13", false, false, false, false, 0],
    ]);
  });

  it("fatos do dia: treinos, volume sem aquecimento, melhor sessão, PRs e refeições", async () => {
    const rows = await fetchDailyScores("2026-09-07", "2026-09-11", db);
    expect(rows.map((r) => [r.day, r.workouts, r.volumeKg, r.bestSessionKg, r.prs, r.mealsPlanned, r.mealsDone])).toEqual([
      ["2026-09-07", 1, 1000, 1000, 2, 5, 5],
      ["2026-09-08", 0, 0, 0, 0, 4, 3],
      ["2026-09-09", 0, 0, 0, 0, 4, 4],
      ["2026-09-10", 0, 0, 0, 0, 4, 0],
      ["2026-09-11", 2, 1280, 1080, 0, 5, 4],
    ]);
  });

  it("virada de dia e de mês às 23h30 em UTC−3: treino e tarefa ficam em 31/08", async () => {
    const rows = await fetchDailyScores("2026-08-31", "2026-09-01", db);
    expect(rows.map((r) => [r.day, r.trained, r.tasks, r.score])).toEqual([
      ["2026-08-31", true, true, 2],
      ["2026-09-01", false, false, 0],
    ]);
  });

  it("dias futuros não voltam: o último dia é hoje (São Paulo)", async () => {
    const today = dayInSaoPaulo(new Date());
    const rows = await fetchDailyScores(addDays(today, -2), addDays(today, 30), db);
    expect(rows.map((r) => r.day)).toEqual([addDays(today, -2), addDays(today, -1), today]);
    expect(await fetchDailyScores(addDays(today, 1), addDays(today, 5), db)).toEqual([]);
  });

  it("até 400 dias por chamada; intervalo invertido é recusado", async () => {
    expect(await fetchDailyScores("2025-08-01", "2026-09-04", db)).toHaveLength(400);
    await expect(fetchDailyScores("2025-08-01", "2026-09-05", db)).rejects.toThrow();
    await expect(fetchDailyScores("2026-09-10", "2026-09-01", db)).rejects.toThrow();
  });
});

describe("month_summary", () => {
  it("setembro × agosto batem com o cálculo manual", async () => {
    const s = await fetchMonthSummary("2026-09-15", db);
    expect(s.month).toBe("2026-09-01");
    expect(s.current).toEqual({
      month: "2026-09-01",
      days: 30,
      workouts: 3,
      volume_kg: 2280,
      prs: {
        count: 2,
        list: [
          { day: "2026-09-07", exercise_id: ids.supino, exercise: "Supino reto", kind: "weight", value: 100, weight_kg: 100, reps: 10, distance_m: null, duration_s: null },
          { day: "2026-09-07", exercise_id: ids.supino, exercise: "Supino reto", kind: "e1rm", value: 133.33, weight_kg: 100, reps: 10, distance_m: null, duration_s: null },
        ],
      },
      control_days: 2,
      // 30 dias × 4 diárias + 2 dias de treino × pós-treino = 122; feitas: 5 + 3 + 4 + 0 + 4 = 16.
      meals: { planned: 122, done: 16, pct: 13 },
      cardio: { minutes: 40, distance_km: 6.2, sessions: 1 },
      nutrition: {
        logged_days: 5,
        training_days: 2,
        options: expect.arrayContaining([
          { option_id: option[ids.cafe], count: 4, selected_item_indices: null },
          { option_id: option[ids.almoco], count: 4, selected_item_indices: null },
          { option_id: option[ids.jantar], count: 4, selected_item_indices: null },
          { option_id: option[ids.lanche], count: 3, selected_item_indices: null },
          { option_id: option[ids.pos], count: 1, selected_item_indices: null },
        ]),
        off_plan: { kcal: 185, protein: 3.9, carbs: 38.6, fat: 1.5 },
      },
      composition: {
        count: 2,
        first: { day: "2026-09-01", weight_kg: 81.5, body_fat_pct: 21.5, skeletal_muscle_kg: 34.2 },
        last: { day: "2026-09-30", weight_kg: 80, body_fat_pct: 20.5, skeletal_muscle_kg: 35 },
        change: { weight_kg: -1.5, body_fat_pct: -1, skeletal_muscle_kg: 0.8 },
      },
    });
    expect(s.current.nutrition.options).toHaveLength(5);

    expect(s.previous).toEqual({
      month: "2026-08-01",
      days: 31,
      workouts: 1,
      volume_kg: 800,
      prs: {
        count: 1,
        list: [
          { day: "2026-08-31", exercise_id: ids.supino, exercise: "Supino reto", kind: "weight", value: 80, weight_kg: 80, reps: 10, distance_m: null, duration_s: null },
        ],
      },
      control_days: 0,
      meals: { planned: 125, done: 0, pct: 0 },
      cardio: { minutes: 30, distance_km: 4.5, sessions: 1 },
      nutrition: { logged_days: 0, training_days: 0, options: [], off_plan: { kcal: 0, protein: 0, carbs: 0, fat: 0 } },
      composition: {
        count: 1,
        first: { day: "2026-08-31", weight_kg: 82, body_fat_pct: 22, skeletal_muscle_kg: 34 },
        last: { day: "2026-08-31", weight_kg: 82, body_fat_pct: 22, skeletal_muscle_kg: 34 },
        change: { weight_kg: 0, body_fat_pct: 0, skeletal_muscle_kg: 0 },
      },
    });
  });

  it("separa no resumo mensal uma seleção parcial da opção completa", async () => {
    const query = db.from("meal_logs").update({ selected_item_indices: [0] }).eq("day", "2026-09-08").eq("meal_id", ids.cafe);
    await exec(query);
    try {
      const summary = await fetchMonthSummary("2026-09-01", db);
      expect(summary.current.nutrition.options).toEqual(
        expect.arrayContaining([
          { option_id: option[ids.cafe], count: 3, selected_item_indices: null },
          { option_id: option[ids.cafe], count: 1, selected_item_indices: [0] },
        ]),
      );
    } finally {
      await exec(db.from("meal_logs").update({ selected_item_indices: null }).eq("day", "2026-09-08").eq("meal_id", ids.cafe));
    }
  });

  it("médias de kcal e proteína do mês saem do domínio com o plano", async () => {
    const s = await fetchMonthSummary("2026-09-01", db);
    const { data: options } = await db.from("meal_options").select("id, items");
    const items = new Map(options!.map((o) => [o.id, o.items as unknown as PlanItem[]]));
    const out = monthNutrition(s.current.nutrition, items, new Map(), {
      rest: macros(2000, 150),
      training: macros(2200, 150),
    });
    // kcal: (4×300 + 4×600 + 4×700 + 3×200 + 1×250 + 185) / 5 = 7435 / 5
    expect(out.consumed!.kcal).toBeCloseTo(1487, 6);
    // proteína: (80 + 160 + 180 + 45 + 30 + 3,9) / 5
    expect(out.consumed!.protein).toBeCloseTo(99.78, 6);
    // meta: (3 × 2000 + 2 × 2200) / 5
    expect(out.goal!.kcal).toBe(2080);
  });

  it("mês vazio: zeros (o plano ainda prevê refeições) e mês anterior também vazio", async () => {
    const s = await fetchMonthSummary("2025-01-20", db);
    expect(s.current).toMatchObject({
      month: "2025-01-01",
      days: 31,
      workouts: 0,
      volume_kg: 0,
      prs: { count: 0, list: [] },
      control_days: 0,
      meals: { planned: 124, done: 0, pct: 0 },
      cardio: { minutes: 0, distance_km: 0, sessions: 0 },
      composition: null,
    });
    expect(s.previous).toMatchObject({ month: "2024-12-01", days: 31, workouts: 0, control_days: 0 });
  });

  it("mês em curso conta só até hoje; mês futuro não tem dias", async () => {
    const today = dayInSaoPaulo(new Date());
    expect((await fetchMonthSummary(today, db)).current.days).toBe(Number(today.slice(8, 10)));
    const future = await fetchMonthSummary("2099-01-01", db);
    expect(future.current).toMatchObject({ days: 0, workouts: 0, meals: { planned: 0, done: 0, pct: 0 } });
  });
});

describe("RLS", () => {
  it("outro usuário não vê nada do dono nas duas RPCs", async () => {
    const other = await createTestUser("scores-outro");
    try {
      const otherDb = other.client as SupabaseClient<Database>;
      const rows = await fetchDailyScores("2026-09-07", "2026-09-13", otherDb);
      expect(rows).toHaveLength(7);
      expect(rows.every((r) => r.score === 0 && r.workouts === 0 && r.mealsPlanned === 0)).toBe(true);
      // Sem nenhum hábito diário ativo, o critério de hábitos não conta.
      expect(rows.some((r) => r.habits)).toBe(false);

      const s = await fetchMonthSummary("2026-09-01", otherDb);
      expect(s.current).toMatchObject({
        workouts: 0,
        volume_kg: 0,
        prs: { count: 0, list: [] },
        control_days: 0,
        meals: { planned: 0, done: 0, pct: 0 },
        cardio: { minutes: 0, distance_km: 0, sessions: 0 },
        nutrition: { logged_days: 0, options: [] },
        composition: null,
      });
    } finally {
      await deleteTestUser(other);
    }
  });

  it("anônimo não chama as RPCs", async () => {
    const anon = anonClient();
    expect((await anon.rpc("daily_scores", { p_from: "2026-09-07", p_to: "2026-09-13" })).error).not.toBeNull();
    expect((await anon.rpc("month_summary", { p_month: "2026-09-01" })).error).not.toBeNull();
  });
});
