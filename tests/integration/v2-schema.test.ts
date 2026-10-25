import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminClient, anonClient, createTestUser, deleteTestUser, type TestUser } from "../support/test-users";

/**
 * Esquema v2: colunas novas, tabelas `profiles`, `foods` e `meal_log_items` (RLS),
 * views sem aquecimento e `finish_workout` com o payload novo e o antigo.
 */

async function must(op: PromiseLike<{ error: unknown }>) {
  const { error } = await op;
  if (error) throw new Error(JSON.stringify(error));
}

async function newExercise(client: SupabaseClient, name: string, extra: Record<string, unknown> = {}) {
  const id = crypto.randomUUID();
  await must(client.from("exercises").insert({ id, name, ...extra }));
  return id;
}

type SetInput = Record<string, unknown>;

function workoutPayload(day: string, exercises: [string, SetInput[]][]) {
  return {
    id: crypto.randomUUID(),
    routine_id: null,
    started_at: `${day}T10:00:00Z`,
    finished_at: `${day}T11:00:00Z`,
    day,
    notes: null,
    exercises: exercises.map(([exercise_id, sets]) => ({
      id: crypto.randomUUID(),
      exercise_id,
      sets: sets.map((s) => ({ id: crypto.randomUUID(), pr_kinds: [], ...s })),
    })),
  };
}

let owner: TestUser;
let other: TestUser;

beforeAll(async () => {
  owner = await createTestUser("v2-dono");
  other = await createTestUser("v2-outro");
});

afterAll(async () => {
  await deleteTestUser(owner);
  await deleteTestUser(other);
});

describe("colunas novas", () => {
  it("exercício nasce como carga × reps, do Bctrl, sem template do Hevy", async () => {
    const id = await newExercise(owner.client, `Supino ${crypto.randomUUID()}`);
    const { data } = await owner.client
      .from("exercises")
      .select("exercise_type, source, hevy_template_id, secondary_muscles, equipment, thumbnail_url, media_url, instructions")
      .eq("id", id)
      .single();
    expect(data).toEqual({
      exercise_type: "weight_reps",
      source: "bctrl",
      hevy_template_id: null,
      secondary_muscles: [],
      equipment: null,
      thumbnail_url: null,
      media_url: null,
      instructions: null,
    });
  });

  it("tipo de exercício e origem fora da lista são recusados", async () => {
    const bad = await owner.client.from("exercises").insert({ name: `X ${crypto.randomUUID()}`, exercise_type: "cardio" });
    expect(bad.error?.code).toBe("23514");
    const badSource = await owner.client.from("exercises").insert({ name: `Y ${crypto.randomUUID()}`, source: "strava" });
    expect(badSource.error?.code).toBe("23514");
  });

  it("hevy_template_id é único por usuário (mas dois usuários podem ter o mesmo)", async () => {
    await newExercise(owner.client, `Rosca ${crypto.randomUUID()}`, { hevy_template_id: "ABC123", source: "hevy" });
    const dup = await owner.client
      .from("exercises")
      .insert({ name: `Rosca 2 ${crypto.randomUUID()}`, hevy_template_id: "ABC123", source: "hevy" });
    expect(dup.error?.code).toBe("23505");
    await expect(
      newExercise(other.client, `Rosca ${crypto.randomUUID()}`, { hevy_template_id: "ABC123", source: "hevy" }),
    ).resolves.toBeTruthy();
  });

  it("workouts ganham source e hevy_workout_id único por usuário", async () => {
    const row = { started_at: "2026-01-01T10:00:00Z", finished_at: "2026-01-01T11:00:00Z", day: "2026-01-01" };
    const id = crypto.randomUUID();
    await must(owner.client.from("workouts").insert({ id, ...row, hevy_workout_id: "hevy-1", source: "hevy" }));
    const { data } = await owner.client.from("workouts").select("source, hevy_workout_id").eq("id", id).single();
    expect(data).toEqual({ source: "hevy", hevy_workout_id: "hevy-1" });
    const dup = await owner.client.from("workouts").insert({ ...row, hevy_workout_id: "hevy-1", source: "hevy" });
    expect(dup.error?.code).toBe("23505");
    const { data: plain } = await owner.client.from("workouts").insert(row).select("source").single();
    expect(plain).toEqual({ source: "bctrl" });
  });
});

describe("profiles (RLS de dono)", () => {
  beforeAll(async () => {
    await must(
      owner.client.from("profiles").insert({
        display_name: "Pessoa Teste",
        sex: "m",
        birth_date: "1995-05-10",
        height_cm: 178,
        activity_level: "moderate",
        goal: "lose",
      }),
    );
  });

  it("o dono lê o próprio perfil, com user_id e padrões preenchidos", async () => {
    const { data, error } = await owner.client.from("profiles").select("user_id, protein_g_per_kg, goal_overrides");
    expect(error).toBeNull();
    expect(data).toEqual([{ user_id: owner.id, protein_g_per_kg: 2, goal_overrides: {} }]);
  });

  it("valores fora do domínio são recusados", async () => {
    const { error } = await owner.client.from("profiles").update({ activity_level: "atleta" }).eq("user_id", owner.id);
    expect(error?.code).toBe("23514");
    const sex = await owner.client.from("profiles").update({ sex: "x" }).eq("user_id", owner.id);
    expect(sex.error?.code).toBe("23514");
  });

  it("outro usuário não lê, não altera, não apaga e não grava em nome do dono", async () => {
    expect((await other.client.from("profiles").select("user_id").eq("user_id", owner.id)).data).toEqual([]);
    const upd = await other.client.from("profiles").update({ display_name: "Intruso" }).eq("user_id", owner.id).select();
    expect(upd.data ?? []).toEqual([]);
    const del = await other.client.from("profiles").delete().eq("user_id", owner.id).select();
    expect(del.data ?? []).toEqual([]);
    const ins = await other.client.from("profiles").insert({ user_id: owner.id, display_name: "Intruso" });
    expect(ins.error).not.toBeNull();

    const { data } = await owner.client.from("profiles").select("display_name").single();
    expect(data).toEqual({ display_name: "Pessoa Teste" });
  });

  it("anônimo não lê", async () => {
    expect((await anonClient().from("profiles").select("user_id")).data ?? []).toEqual([]);
  });
});

describe("foods (TACO de leitura geral + alimentos próprios)", () => {
  const tacoId = crypto.randomUUID();
  const tacoNumber = 900_000 + Math.floor(Math.random() * 99_999);
  const ownFood = crypto.randomUUID();

  beforeAll(async () => {
    // Linha de referência da TACO: user_id nulo, gravada pelo serviço (como na migration).
    await must(
      adminClient().from("foods").insert({
        id: tacoId,
        user_id: null,
        taco_id: tacoNumber,
        name: "Arroz, integral, cozido (teste)",
        category: "Cereais e derivados",
        kcal: 124,
        protein_g: 2.6,
        carbs_g: 25.8,
        fat_g: 1,
      }),
    );
    await must(
      owner.client.from("foods").insert({
        id: ownFood,
        name: "Pão da padaria",
        kcal: 280,
        protein_g: 9,
        carbs_g: 55,
        fat_g: 2.5,
        unit_grams: { un: 50 },
      }),
    );
  });

  afterAll(async () => {
    await adminClient().from("foods").delete().eq("id", tacoId);
  });

  it("alimento próprio nasce com o user_id do dono", async () => {
    const { data } = await owner.client.from("foods").select("user_id, unit_grams").eq("id", ownFood).single();
    expect(data).toEqual({ user_id: owner.id, unit_grams: { un: 50 } });
  });

  it("qualquer usuário logado lê a TACO", async () => {
    for (const client of [owner.client, other.client]) {
      const { data } = await client.from("foods").select("id, user_id").eq("id", tacoId);
      expect(data).toEqual([{ id: tacoId, user_id: null }]);
    }
  });

  it("outro usuário não lê nem altera o alimento próprio do dono", async () => {
    expect((await other.client.from("foods").select("id").eq("id", ownFood)).data).toEqual([]);
    const upd = await other.client.from("foods").update({ kcal: 1 }).eq("id", ownFood).select();
    expect(upd.data ?? []).toEqual([]);
    const del = await other.client.from("foods").delete().eq("id", ownFood).select();
    expect(del.data ?? []).toEqual([]);
    const { data } = await owner.client.from("foods").select("kcal").eq("id", ownFood).single();
    expect(Number(data!.kcal)).toBe(280);
  });

  it("ninguém altera, apaga ou cria linhas da TACO pelo app", async () => {
    const upd = await owner.client.from("foods").update({ kcal: 1 }).eq("id", tacoId).select();
    expect(upd.data ?? []).toEqual([]);
    const del = await owner.client.from("foods").delete().eq("id", tacoId).select();
    expect(del.data ?? []).toEqual([]);
    const ins = await owner.client
      .from("foods")
      .insert({ user_id: null, name: "Falso TACO", kcal: 1, protein_g: 0, carbs_g: 0, fat_g: 0 });
    expect(ins.error?.code).toBe("42501");
    const { data } = await owner.client.from("foods").select("kcal").eq("id", tacoId).single();
    expect(Number(data!.kcal)).toBe(124);
  });

  it("anônimo não lê nem a TACO", async () => {
    expect((await anonClient().from("foods").select("id")).data ?? []).toEqual([]);
  });

  describe("meal_log_items", () => {
    let mealLogId: string;
    let itemId: string;

    beforeAll(async () => {
      const mealId = crypto.randomUUID();
      mealLogId = crypto.randomUUID();
      itemId = crypto.randomUUID();
      await must(owner.client.from("meals").insert({ id: mealId, name: "Lanche", position: 1 }));
      await must(owner.client.from("meal_logs").insert({ id: mealLogId, day: "2026-10-13", meal_id: mealId, off_plan: true }));
      await must(
        owner.client.from("meal_log_items").insert({
          id: itemId,
          meal_log_id: mealLogId,
          food_id: tacoId,
          name: "Arroz, integral, cozido",
          grams: 150,
          kcal: 186,
          protein_g: 3.9,
          carbs_g: 38.7,
          fat_g: 1.5,
        }),
      );
    });

    it("o dono lê o item (snapshot dos macros) com user_id padrão", async () => {
      const { data } = await owner.client.from("meal_log_items").select("user_id, grams, kcal").eq("id", itemId).single();
      expect(data && { ...data, grams: Number(data.grams), kcal: Number(data.kcal) }).toEqual({
        user_id: owner.id,
        grams: 150,
        kcal: 186,
      });
    });

    it("aceita alimento próprio e recusa alimento próprio de outro usuário", async () => {
      await must(
        owner.client.from("meal_log_items").insert({
          meal_log_id: mealLogId,
          food_id: ownFood,
          name: "Pão",
          grams: 50,
          kcal: 140,
          protein_g: 4.5,
          carbs_g: 27.5,
          fat_g: 1.3,
        }),
      );
      const otherFood = crypto.randomUUID();
      await must(
        other.client
          .from("foods")
          .insert({ id: otherFood, name: "Bolo da vó", kcal: 350, protein_g: 5, carbs_g: 50, fat_g: 14 }),
      );
      const { error } = await owner.client.from("meal_log_items").insert({
        meal_log_id: mealLogId,
        food_id: otherFood,
        name: "Bolo",
        grams: 80,
        kcal: 280,
        protein_g: 4,
        carbs_g: 40,
        fat_g: 11,
      });
      expect(error?.code).toBe("42501");
    });

    it("outro usuário não lê, não altera, não apaga e não pendura item no registro do dono", async () => {
      expect((await other.client.from("meal_log_items").select("id").eq("id", itemId)).data).toEqual([]);
      const upd = await other.client.from("meal_log_items").update({ grams: 1 }).eq("id", itemId).select();
      expect(upd.data ?? []).toEqual([]);
      const del = await other.client.from("meal_log_items").delete().eq("id", itemId).select();
      expect(del.data ?? []).toEqual([]);
      const ins = await other.client.from("meal_log_items").insert({
        meal_log_id: mealLogId,
        name: "Intruso",
        grams: 10,
        kcal: 1,
        protein_g: 0,
        carbs_g: 0,
        fat_g: 0,
      });
      expect(ins.error).not.toBeNull();
    });

    it("anônimo não lê", async () => {
      expect((await anonClient().from("meal_log_items").select("id")).data ?? []).toEqual([]);
    });

    it("apagar o registro da refeição apaga os itens (cascata)", async () => {
      await must(owner.client.from("meal_logs").delete().eq("id", mealLogId));
      const { count } = await owner.client
        .from("meal_log_items")
        .select("id", { count: "exact", head: true })
        .eq("meal_log_id", mealLogId);
      expect(count).toBe(0);
    });
  });
});

describe("finish_workout v2 e views", () => {
  let user: TestUser;
  let supino: string;
  let prancha: string;
  let corrida: string;
  let rosca: string;

  beforeAll(async () => {
    user = await createTestUser("v2-treino");
    supino = await newExercise(user.client, "Supino");
    prancha = await newExercise(user.client, "Prancha", { exercise_type: "duration" });
    corrida = await newExercise(user.client, "Corrida", { exercise_type: "distance_duration" });
    rosca = await newExercise(user.client, "Rosca com isometria", { exercise_type: "weight_duration" });
  });

  afterAll(() => deleteTestUser(user));

  it("payload novo: prancha 60 s, corrida 2 km / 12 min e supino com aquecimento", async () => {
    const body = workoutPayload("2026-10-01", [
      [prancha, [{ duration_s: 60 }]],
      [corrida, [{ distance_m: 2000, duration_s: 720 }]],
      [
        supino,
        [
          { set_type: "warmup", weight_kg: 100, reps: 10 },
          { weight_kg: 60, reps: 10 },
          { set_type: "failure", weight_kg: 60, reps: 8 },
        ],
      ],
      [rosca, [{ weight_kg: 12, duration_s: 30 }]],
    ]);
    const { data, error } = await user.client.rpc("finish_workout", { payload: body });
    expect(error).toBeNull();
    expect(data).toBe(body.id);

    const { data: rows } = await user.client
      .from("workout_exercises")
      .select("exercise_id, workout_sets(position, set_type, weight_kg, reps, distance_m, duration_s)")
      .eq("workout_id", body.id)
      .order("position")
      .order("position", { referencedTable: "workout_sets" });
    const num = (v: unknown) => (v === null ? null : Number(v));
    expect(
      rows!.map((r) => [
        r.exercise_id,
        r.workout_sets.map((s: Record<string, unknown>) => [
          s.set_type,
          num(s.weight_kg),
          s.reps,
          num(s.distance_m),
          s.duration_s,
        ]),
      ]),
    ).toEqual([
      [prancha, [["normal", null, null, null, 60]]],
      [corrida, [["normal", null, null, 2000, 720]]],
      [
        supino,
        [
          ["warmup", 100, 10, null, null],
          ["normal", 60, 10, null, null],
          ["failure", 60, 8, null, null],
        ],
      ],
      [rosca, [["normal", 12, null, null, 30]]],
    ]);
  });

  it("payload antigo da v1 (sem set_type, distância e duração) continua aceito", async () => {
    const body = workoutPayload("2026-10-02", [[supino, [{ weight_kg: 62.5, reps: 6 }]]]);
    const { error } = await user.client.rpc("finish_workout", { payload: body });
    expect(error).toBeNull();
    const { data } = await user.client
      .from("workout_sets")
      .select("set_type, weight_kg, reps, distance_m, duration_s, workout_exercises!inner(workout_id)")
      .eq("workout_exercises.workout_id", body.id)
      .single();
    expect(data).toMatchObject({ set_type: "normal", reps: 6, distance_m: null, duration_s: null });
    expect(Number(data!.weight_kg)).toBe(62.5);
  });

  it("série sem nenhuma métrica ou com tipo inválido desfaz o treino inteiro", async () => {
    for (const bad of [{}, { set_type: "pirâmide", reps: 10 }, { duration_s: -5 }]) {
      const body = workoutPayload("2026-10-03", [[supino, [{ weight_kg: 50, reps: 10 }, bad]]]);
      const { error } = await user.client.rpc("finish_workout", { payload: body });
      expect(error?.code).toBe("23514");
      const { count } = await user.client.from("workouts").select("id", { count: "exact", head: true }).eq("id", body.id);
      expect(count).toBe(0);
    }
  });

  it("v_exercise_bests: aquecimento fora; carga/1RM/volume só com carga e reps; duração e distância", async () => {
    const { data } = await user.client
      .from("v_exercise_bests")
      .select("exercise_id, max_weight, max_set_volume, max_e1rm, max_duration_s, max_distance_m")
      .in("exercise_id", [supino, prancha, corrida, rosca]);
    const byId = new Map(data!.map((r) => [r.exercise_id, r]));
    const numbers = (r: Record<string, unknown> | undefined) =>
      r && Object.fromEntries(Object.entries(r).filter(([k]) => k !== "exercise_id").map(([k, v]) => [k, v === null ? null : Number(v)]));

    // Aquecimento 100 × 10 ignorado: o melhor é 62,5 × 6 (carga) e 60 × 10 (volume e 1RM).
    expect(numbers(byId.get(supino))).toEqual({
      max_weight: 62.5,
      max_set_volume: 600,
      max_e1rm: 80,
      max_duration_s: null,
      max_distance_m: null,
    });
    expect(numbers(byId.get(prancha))).toEqual({
      max_weight: null,
      max_set_volume: null,
      max_e1rm: null,
      max_duration_s: 60,
      max_distance_m: null,
    });
    expect(numbers(byId.get(corrida))).toMatchObject({ max_weight: null, max_duration_s: 720, max_distance_m: 2000 });
    // Carga sem reps (isometria) não vira recorde de carga.
    expect(numbers(byId.get(rosca))).toMatchObject({ max_weight: null, max_e1rm: null, max_duration_s: 30 });
  });

  it("v_exercise_session_stats: aquecimento fora do volume e da contagem; duração e distância por sessão", async () => {
    const { data } = await user.client
      .from("v_exercise_session_stats")
      .select("exercise_id, day, best_weight, volume, sets, best_duration_s, best_distance_m")
      .in("exercise_id", [supino, prancha, corrida])
      .order("day");
    const rows = data!.map((r) => ({
      ...r,
      best_weight: r.best_weight === null ? null : Number(r.best_weight),
      volume: r.volume === null ? null : Number(r.volume),
      best_distance_m: r.best_distance_m === null ? null : Number(r.best_distance_m),
    }));
    expect(rows.filter((r) => r.exercise_id === supino)).toEqual([
      { exercise_id: supino, day: "2026-10-01", best_weight: 60, volume: 1080, sets: 2, best_duration_s: null, best_distance_m: null },
      { exercise_id: supino, day: "2026-10-02", best_weight: 62.5, volume: 375, sets: 1, best_duration_s: null, best_distance_m: null },
    ]);
    expect(rows.find((r) => r.exercise_id === prancha)).toMatchObject({ best_weight: null, volume: null, sets: 1, best_duration_s: 60 });
    expect(rows.find((r) => r.exercise_id === corrida)).toMatchObject({ best_duration_s: 720, best_distance_m: 2000 });
  });

  it("v_exercise_last_sets: o anterior traz só as séries de trabalho, com duração e distância", async () => {
    const supinoOnly = workoutPayload("2026-10-04", [
      [supino, [{ set_type: "warmup", weight_kg: 30, reps: 12 }, { weight_kg: 65, reps: 5 }]],
    ]);
    await must(user.client.rpc("finish_workout", { payload: supinoOnly }));
    const { data } = await user.client
      .from("v_exercise_last_sets")
      .select("exercise_id, position, weight_kg, reps, distance_m, duration_s")
      .in("exercise_id", [supino, corrida])
      .order("position");
    expect(
      data!.map((r) => [
        r.exercise_id,
        r.position,
        r.weight_kg === null ? null : Number(r.weight_kg),
        r.reps,
        r.distance_m === null ? null : Number(r.distance_m),
        r.duration_s,
      ]),
    ).toEqual(
      expect.arrayContaining([
        [supino, 1, 65, 5, null, null],
        [corrida, 1, null, null, 2000, 720],
      ]),
    );
    expect(data!.filter((r) => r.exercise_id === supino)).toHaveLength(1);
  });

  it("aquecimento não aparece nas views de outro usuário (RLS mantido)", async () => {
    const { data } = await other.client.from("v_exercise_bests").select("*").eq("exercise_id", supino);
    expect(data).toEqual([]);
  });
});
