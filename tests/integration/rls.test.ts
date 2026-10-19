import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createOwnedRows, PATCHES, TABLES, validRow, type OwnedRows } from "../support/db-fixtures";
import { anonClient, createTestUser, deleteTestUser, type TestUser } from "../support/test-users";

const VIEWS = ["v_exercise_session_stats", "v_exercise_bests", "v_exercise_last_sets"] as const;

let a: TestUser;
let b: TestUser;
let rowsA: OwnedRows;

beforeAll(async () => {
  a = await createTestUser("rls-a");
  b = await createTestUser("rls-b");
  rowsA = await createOwnedRows(a.client);
});

afterAll(async () => {
  await deleteTestUser(a);
  await deleteTestUser(b);
});

describe.each(TABLES)("RLS em %s", (table) => {
  it("o dono lê a própria linha, com user_id preenchido por padrão", async () => {
    const { data, error } = await a.client.from(table).select("id, user_id").eq("id", rowsA[table]);
    expect(error).toBeNull();
    expect(data).toEqual([{ id: rowsA[table], user_id: a.id }]);
  });

  it("outro usuário não lê", async () => {
    const { data, error } = await b.client.from(table).select("id").eq("id", rowsA[table]);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("outro usuário não altera", async () => {
    const { data } = await b.client.from(table).update(PATCHES[table]).eq("id", rowsA[table]).select("id");
    expect(data ?? []).toEqual([]);

    const { data: still } = await a.client.from(table).select("*").eq("id", rowsA[table]).single();
    for (const [column, value] of Object.entries(PATCHES[table])) {
      expect(still?.[column]).not.toEqual(value);
    }
  });

  it("outro usuário não apaga", async () => {
    const { data } = await b.client.from(table).delete().eq("id", rowsA[table]).select("id");
    expect(data ?? []).toEqual([]);

    const { count } = await a.client
      .from(table)
      .select("id", { count: "exact", head: true })
      .eq("id", rowsA[table]);
    expect(count).toBe(1);
  });

  it("outro usuário não grava em nome do dono", async () => {
    // Linha válida (pais do dono, user_id do dono): só o RLS pode barrar.
    const { error } = await b.client.from(table).insert({ ...validRow(table, rowsA), user_id: a.id });
    expect(error?.code).toBe("42501");
  });

  it("outro usuário não transfere a linha para si", async () => {
    const { data } = await b.client.from(table).update({ user_id: b.id }).eq("id", rowsA[table]).select("id");
    expect(data ?? []).toEqual([]);
    const { error } = await a.client.from(table).update({ user_id: b.id }).eq("id", rowsA[table]);
    expect(error).not.toBeNull();
  });

  it("anônimo não lê", async () => {
    const { data } = await anonClient().from(table).select("id");
    expect(data ?? []).toEqual([]);
  });
});

describe.each(VIEWS)("RLS na view %s", (view) => {
  it("o dono vê as próprias estatísticas", async () => {
    const { data, error } = await a.client.from(view).select("*").eq("exercise_id", rowsA.exercises);
    expect(error).toBeNull();
    expect(data?.length).toBeGreaterThan(0);
    expect(data?.every((row) => row.user_id === a.id)).toBe(true);
  });

  it("outro usuário não vê nada do dono", async () => {
    const { data, error } = await b.client.from(view).select("*");
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("anônimo não lê", async () => {
    const { data } = await anonClient().from(view).select("*");
    expect(data ?? []).toEqual([]);
  });
});

describe("referências entre usuários", () => {
  it("não permite pendurar dados próprios em linhas alheias", async () => {
    const ownExercise = crypto.randomUUID();
    await b.client.from("exercises").insert({ id: ownExercise, name: "Remada" });

    const attempts = [
      b.client.from("routine_exercises").insert({
        routine_id: rowsA.routines,
        exercise_id: ownExercise,
        position: 1,
        sets: 3,
      }),
      b.client.from("workout_exercises").insert({
        workout_id: rowsA.workouts,
        exercise_id: ownExercise,
        position: 1,
      }),
      b.client.from("workout_sets").insert({
        workout_exercise_id: rowsA.workout_exercises,
        position: 2,
        weight_kg: 10,
        reps: 10,
      }),
      b.client.from("meal_options").insert({ meal_id: rowsA.meals, position: 2, title: "Intrusa" }),
      b.client.from("meal_logs").insert({ day: "2026-10-14", meal_id: rowsA.meals }),
      b.client.from("habit_logs").insert({ habit_id: rowsA.habits, day: "2026-10-14", value: 1 }),
    ];
    for (const { error } of await Promise.all(attempts)) {
      expect(error).not.toBeNull();
    }

    const { count } = await a.client.from("habit_logs").select("id", { count: "exact", head: true });
    expect(count).toBe(1);
  });
});

describe("hábitos do sistema", () => {
  let owner: TestUser;
  const systemHabit = crypto.randomUUID();
  const customHabit = crypto.randomUUID();

  beforeAll(async () => {
    owner = await createTestUser("habits");
    const { error } = await owner.client.from("habits").insert([
      { id: systemHabit, name: "Abdominal", kind: "check", period: "week", target: 3, system_key: "abs" },
      { id: customHabit, name: "Ler", kind: "check", period: "week", target: 3 },
    ]);
    if (error) throw error;
  });

  afterAll(() => deleteTestUser(owner));

  it("não podem ser excluídos", async () => {
    const { error } = await owner.client.from("habits").delete().eq("id", systemHabit);
    expect(error).not.toBeNull();
    const { count } = await owner.client
      .from("habits")
      .select("id", { count: "exact", head: true })
      .eq("id", systemHabit);
    expect(count).toBe(1);
  });

  it("podem ser editados, mas não perdem a system_key", async () => {
    const { error: renameError } = await owner.client
      .from("habits")
      .update({ name: "Abdominais", target: 4 })
      .eq("id", systemHabit);
    expect(renameError).toBeNull();

    const { error: keyError } = await owner.client.from("habits").update({ system_key: null }).eq("id", systemHabit);
    expect(keyError).not.toBeNull();
  });

  it("não admitem system_key repetida nem desconhecida", async () => {
    const dup = await owner.client
      .from("habits")
      .insert({ name: "Abs 2", kind: "check", period: "week", target: 3, system_key: "abs" });
    expect(dup.error).not.toBeNull();
    const unknown = await owner.client
      .from("habits")
      .insert({ name: "X", kind: "check", period: "week", target: 3, system_key: "treino" });
    expect(unknown.error).not.toBeNull();
  });

  it("hábitos customizados podem ser excluídos", async () => {
    const { data, error } = await owner.client.from("habits").delete().eq("id", customHabit).select("id");
    expect(error).toBeNull();
    expect(data).toEqual([{ id: customHabit }]);
  });

  it("excluir o usuário apaga tudo por cascata, inclusive hábitos do sistema", async () => {
    const temp = await createTestUser("cascade");
    await createOwnedRows(temp.client);
    await temp.client
      .from("habits")
      .insert({ name: "Cardio", kind: "cardio", period: "week", target: 150, unit: "min", system_key: "cardio" });
    await expect(deleteTestUser(temp)).resolves.toBeUndefined();
  });
});
