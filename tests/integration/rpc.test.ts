import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { anonClient, createTestUser, deleteTestUser, type TestUser } from "../support/test-users";

async function newExercise(client: SupabaseClient, name: string): Promise<string> {
  const id = crypto.randomUUID();
  const { error } = await client.from("exercises").insert({ id, name });
  if (error) throw error;
  return id;
}

/** Falha o setup se a gravação der erro (em vez de seguir com dados faltando). */
async function must(op: PromiseLike<{ error: unknown }>) {
  const { error } = await op;
  if (error) throw new Error(JSON.stringify(error));
}

function payload(exerciseIds: string[], overrides: Record<string, unknown> = {}) {
  return {
    id: crypto.randomUUID(),
    routine_id: null,
    started_at: "2026-10-13T10:00:00Z",
    finished_at: "2026-10-13T11:05:00Z",
    day: "2026-10-13",
    notes: "boa sessão",
    exercises: exerciseIds.map((exercise_id) => ({
      id: crypto.randomUUID(),
      exercise_id,
      notes: null,
      sets: [
        { id: crypto.randomUUID(), weight_kg: 40, reps: 12, pr_kinds: [] },
        { id: crypto.randomUUID(), weight_kg: 50, reps: 8, pr_kinds: ["weight", "e1rm"] },
      ],
    })),
    ...overrides,
  };
}

async function countWorkoutRows(client: SupabaseClient, workoutId: string) {
  const workouts = await client.from("workouts").select("id", { count: "exact", head: true }).eq("id", workoutId);
  const exercises = await client
    .from("workout_exercises")
    .select("id", { count: "exact", head: true })
    .eq("workout_id", workoutId);
  const sets = await client
    .from("workout_sets")
    .select("id, workout_exercises!inner(workout_id)", { count: "exact", head: true })
    .eq("workout_exercises.workout_id", workoutId);
  return { workouts: workouts.count, exercises: exercises.count, sets: sets.count };
}

describe("finish_workout", () => {
  let user: TestUser;
  let other: TestUser;
  let supino: string;
  let remada: string;

  beforeAll(async () => {
    user = await createTestUser("rpc");
    other = await createTestUser("rpc-other");
    supino = await newExercise(user.client, "Supino");
    remada = await newExercise(user.client, "Remada");
  });

  afterAll(async () => {
    await deleteTestUser(user);
    await deleteTestUser(other);
  });

  it("grava treino, exercícios e séries na ordem do payload", async () => {
    const body = payload([supino, remada]);
    const { data, error } = await user.client.rpc("finish_workout", { payload: body });
    expect(error).toBeNull();
    expect(data).toBe(body.id);

    expect(await countWorkoutRows(user.client, body.id)).toEqual({ workouts: 1, exercises: 2, sets: 4 });

    const { data: exercises } = await user.client
      .from("workout_exercises")
      .select("exercise_id, position, workout_sets(position, weight_kg, reps, pr_kinds)")
      .eq("workout_id", body.id)
      .order("position");
    expect(exercises?.map((e) => e.exercise_id)).toEqual([supino, remada]);
    const sets = [...(exercises?.[0].workout_sets ?? [])].sort((x, y) => x.position - y.position);
    expect(sets).toEqual([
      { position: 1, weight_kg: 40, reps: 12, pr_kinds: [] },
      { position: 2, weight_kg: 50, reps: 8, pr_kinds: ["weight", "e1rm"] },
    ]);
  });

  it("é idempotente: o mesmo payload duas vezes gera um único treino", async () => {
    const body = payload([supino]);
    const first = await user.client.rpc("finish_workout", { payload: body });
    const second = await user.client.rpc("finish_workout", { payload: body });
    expect(first.error).toBeNull();
    expect(second.error).toBeNull();
    expect(second.data).toBe(body.id);
    expect(await countWorkoutRows(user.client, body.id)).toEqual({ workouts: 1, exercises: 1, sets: 2 });
  });

  it("é atômica: série inválida no meio não deixa nada gravado", async () => {
    const body = payload([supino, remada]);
    body.exercises[1].sets[1] = { id: crypto.randomUUID(), weight_kg: -5, reps: 8, pr_kinds: [] };
    const { error } = await user.client.rpc("finish_workout", { payload: body });
    expect(error).not.toBeNull();
    expect(await countWorkoutRows(user.client, body.id)).toEqual({ workouts: 0, exercises: 0, sets: 0 });
  });

  it.each([
    ["sem exercícios", (b: ReturnType<typeof payload>) => ({ ...b, exercises: [] })],
    ["exercício sem séries", (b: ReturnType<typeof payload>) => ({ ...b, exercises: [{ ...b.exercises[0], sets: [] }] })],
    [
      "reps não inteiras",
      (b: ReturnType<typeof payload>) => ({
        ...b,
        exercises: [{ ...b.exercises[0], sets: [{ weight_kg: 10, reps: 8.5, pr_kinds: [] }] }],
      }),
    ],
    ["fim antes do início", (b: ReturnType<typeof payload>) => ({ ...b, finished_at: "2026-10-13T09:00:00Z" })],
    [
      "tipo de PR desconhecido",
      (b: ReturnType<typeof payload>) => ({
        ...b,
        exercises: [{ ...b.exercises[0], sets: [{ weight_kg: 10, reps: 8, pr_kinds: ["sorte"] }] }],
      }),
    ],
  ])("rejeita payload inválido (%s) sem gravar", async (_label, mutate) => {
    const body = mutate(payload([supino]));
    const { error } = await user.client.rpc("finish_workout", { payload: body });
    expect(error).not.toBeNull();
    expect(await countWorkoutRows(user.client, body.id)).toEqual({ workouts: 0, exercises: 0, sets: 0 });
  });

  it("não aceita exercício de outro usuário", async () => {
    const body = payload([supino]);
    const { error } = await other.client.rpc("finish_workout", { payload: body });
    expect(error).not.toBeNull();
    expect((await countWorkoutRows(user.client, body.id)).workouts).toBe(0);
  });

  it("não devolve nem sobrescreve treino de outro usuário com o mesmo id", async () => {
    const body = payload([supino]);
    await user.client.rpc("finish_workout", { payload: body });
    const otherExercise = await newExercise(other.client, "Agachamento");
    const { error } = await other.client.rpc("finish_workout", {
      payload: { ...payload([otherExercise]), id: body.id },
    });
    expect(error).not.toBeNull();
    expect(await countWorkoutRows(user.client, body.id)).toEqual({ workouts: 1, exercises: 1, sets: 2 });
  });

  it("anônimo não pode chamar", async () => {
    const { error } = await anonClient().rpc("finish_workout", { payload: payload([supino]) });
    expect(error).not.toBeNull();
  });

  it("alimenta as views de estatística", async () => {
    const fresh = await newExercise(user.client, "Rosca");
    const older = payload([fresh], {
      started_at: "2026-10-01T10:00:00Z",
      finished_at: "2026-10-01T11:00:00Z",
      day: "2026-10-01",
    });
    older.exercises[0].sets = [{ id: crypto.randomUUID(), weight_kg: 20, reps: 10, pr_kinds: [] }];
    const newer = payload([fresh]);
    newer.exercises[0].sets = [
      { id: crypto.randomUUID(), weight_kg: 15, reps: 12, pr_kinds: [] },
      { id: crypto.randomUUID(), weight_kg: 18, reps: 6, pr_kinds: [] },
    ];
    await user.client.rpc("finish_workout", { payload: older });
    await user.client.rpc("finish_workout", { payload: newer });

    const { data: stats } = await user.client
      .from("v_exercise_session_stats")
      .select("workout_id, day, best_weight, best_e1rm, volume")
      .eq("exercise_id", fresh)
      .order("day");
    expect(stats).toEqual([
      { workout_id: older.id, day: "2026-10-01", best_weight: 20, best_e1rm: 26.67, volume: 200 },
      { workout_id: newer.id, day: "2026-10-13", best_weight: 18, best_e1rm: 21.6, volume: 288 },
    ]);

    const { data: bests } = await user.client
      .from("v_exercise_bests")
      .select("max_weight, max_set_volume, max_e1rm")
      .eq("exercise_id", fresh)
      .single();
    expect(bests).toEqual({ max_weight: 20, max_set_volume: 200, max_e1rm: 26.67 });

    const { data: last } = await user.client
      .from("v_exercise_last_sets")
      .select("workout_id, position, weight_kg, reps")
      .eq("exercise_id", fresh)
      .order("position");
    expect(last).toEqual([
      { workout_id: newer.id, position: 1, weight_kg: 15, reps: 12 },
      { workout_id: newer.id, position: 2, weight_kg: 18, reps: 6 },
    ]);
  });
});

describe("week_summary", () => {
  let user: TestUser;
  const WEEK = "2026-10-11"; // domingo

  beforeAll(async () => {
    user = await createTestUser("week");
    const c = user.client;
    const exercise = await newExercise(c, "Supino");

    const finished = (day: string) =>
      payload([exercise], { day, started_at: `${day}T10:00:00Z`, finished_at: `${day}T11:00:00Z` });
    for (const day of ["2026-10-13", "2026-10-15", "2026-10-18", "2026-10-10"]) {
      const { error } = await c.rpc("finish_workout", { payload: finished(day) });
      if (error) throw error;
    }
    // Treino iniciado e não finalizado não conta.
    await must(c.from("workouts").insert({ started_at: "2026-10-16T10:00:00Z", day: "2026-10-16" }));

    const cardio = crypto.randomUUID();
    const abs = crypto.randomUUID();
    const supplements = crypto.randomUUID();
    const reading = crypto.randomUUID();
    await must(c.from("habits").insert([
      { id: cardio, name: "Cardio", kind: "cardio", period: "week", target: 150, unit: "min", system_key: "cardio" },
      { id: abs, name: "Abdominal", kind: "check", period: "week", target: 3, system_key: "abs" },
      { id: supplements, name: "Suplementos", kind: "check", period: "day", target: 1, system_key: "supplements" },
      { id: reading, name: "Ler", kind: "quantity", period: "week", target: 60, unit: "min" },
    ], { defaultToNull: false }));
    await must(c.from("habit_logs").insert([
      { habit_id: cardio, day: "2026-10-12", value: 30, cardio_type: "treadmill", distance_km: 4, kcal: 250 },
      { habit_id: cardio, day: "2026-10-14", value: 20, cardio_type: "bike" },
      { habit_id: cardio, day: "2026-10-19", value: 45, cardio_type: "run", distance_km: 7, kcal: 500 },
      { habit_id: abs, day: "2026-10-12", value: 1 },
      { habit_id: abs, day: "2026-10-14", value: 1 },
      { habit_id: supplements, day: "2026-10-12", value: 1 },
      { habit_id: supplements, day: "2026-10-13", value: 1 },
      { habit_id: supplements, day: "2026-10-17", value: 1 },
      { habit_id: reading, day: "2026-10-13", value: 25 },
      { habit_id: reading, day: "2026-10-17", value: 15 },
    ], { defaultToNull: false }));

    // Em inserts em lote, colunas ausentes viram null; `defaultToNull: false` usa o default.
    // 2 refeições diárias + pós-treino: previstas = 2×7 + 1×2 dias com treino = 16.
    const lunch = crypto.randomUUID();
    const dinner = crypto.randomUUID();
    const post = crypto.randomUUID();
    await must(c.from("meals").insert([
      { id: lunch, name: "Almoço", time: "13:30", position: 1 },
      { id: dinner, name: "Jantar", time: "20:00", position: 2 },
      { id: post, name: "Pós-treino", position: 3, training_day_only: true },
    ], { defaultToNull: false }));
    await must(c.from("meal_logs").insert([
      { day: "2026-10-12", meal_id: lunch },
      { day: "2026-10-12", meal_id: dinner },
      { day: "2026-10-13", meal_id: lunch },
      { day: "2026-10-13", meal_id: dinner, off_plan: true, note: "pizza" },
      { day: "2026-10-13", meal_id: post },
      { day: "2026-10-14", meal_id: lunch },
      { day: "2026-10-14", meal_id: post }, // sem treino no dia: não conta
      { day: "2026-10-15", meal_id: lunch },
      { day: "2026-10-19", meal_id: lunch }, // fora da semana
    ], { defaultToNull: false }));
  });

  afterAll(() => deleteTestUser(user));

  it("resume a semana em uma chamada", async () => {
    const { data, error } = await user.client.rpc("week_summary", { p_week_start: WEEK });
    expect(error).toBeNull();
    expect(data).toMatchObject({
      week_start: "2026-10-11",
      week_end: "2026-10-17",
      workouts: { done: 2, target: 4 },
      cardio: { minutes: 50, distance_km: 4, kcal: 250, sessions: 2, target: 150 },
      abs: { done: 2, target: 3 },
      supplements: { done: 3, target: 7 },
      meals: { planned: 16, done: 6, pct: 38 },
    });
    expect(data.days).toHaveLength(7);
    expect(data.days[2]).toEqual({ day: "2026-10-13", trained: true, meals_planned: 3, meals_done: 2 });
    expect(data.days[3]).toEqual({ day: "2026-10-14", trained: false, meals_planned: 2, meals_done: 1 });
    expect(data.habits).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "Ler", system_key: null, total: 40, target: 60 }),
        expect.objectContaining({ system_key: "cardio", total: 50 }),
        expect.objectContaining({ system_key: "abs", total: 2 }),
      ]),
    );
  });

  it("semana vazia devolve zeros", async () => {
    const { data, error } = await user.client.rpc("week_summary", { p_week_start: "2026-01-04" });
    expect(error).toBeNull();
    expect(data).toMatchObject({
      workouts: { done: 0 },
      cardio: { minutes: 0, distance_km: 0, kcal: 0, sessions: 0 },
      meals: { planned: 14, done: 0, pct: 0 },
    });
  });

  it("rejeita data que não é domingo", async () => {
    const { error } = await user.client.rpc("week_summary", { p_week_start: "2026-10-12" });
    expect(error).not.toBeNull();
  });

  it("não enxerga dados de outro usuário", async () => {
    const stranger = await createTestUser("week-stranger");
    try {
      const { data } = await stranger.client.rpc("week_summary", { p_week_start: WEEK });
      expect(data).toMatchObject({ workouts: { done: 0 }, cardio: { minutes: 0 }, meals: { planned: 0 } });
    } finally {
      await deleteTestUser(stranger);
    }
  });
});
