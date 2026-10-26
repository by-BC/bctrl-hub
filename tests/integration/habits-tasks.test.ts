import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  deleteHabit,
  deleteHabitLogs,
  fetchHabitLogs,
  fetchHabits,
  fetchTrainedDays,
  updateHabit,
  upsertHabit,
  upsertHabitLog,
  type HabitLogInsert,
} from "@/features/habits/api";
import { deleteTask, fetchTasks, setTaskDone, upsertTask, type Task } from "@/features/tasks/api";
import { DataError } from "@/features/routines/api";
import { fetchWeekSummary } from "@/features/week/api";
import type { Database } from "@/lib/database.types";
import { habitProgress } from "@/features/habits/domain/habits";
import { weekDays } from "@/lib/domain/week";
import { createTestUser, deleteTestUser, type TestUser } from "../support/test-users";

const WEEK = "2026-10-11"; // domingo; sábado = 2026-10-17
const [FROM, TO] = [WEEK, weekDays(WEEK)[6]];

async function exec(op: PromiseLike<{ error: unknown }>) {
  const { error } = await op;
  if (error) throw new Error(JSON.stringify(error));
}

const log = (habit_id: string, day: string, fields: Partial<HabitLogInsert> = {}): HabitLogInsert => ({
  id: crypto.randomUUID(),
  habit_id,
  day,
  value: 1,
  cardio_type: null,
  distance_km: null,
  kcal: null,
  ...fields,
});

describe("hábitos: registros, totais de cardio e hábitos do sistema", () => {
  let owner: TestUser;
  let other: TestUser;
  let db: SupabaseClient<Database>;
  let otherDb: SupabaseClient<Database>;
  const cardio = crypto.randomUUID();
  const abs = crypto.randomUUID();
  const reading = crypto.randomUUID();

  beforeAll(async () => {
    owner = await createTestUser("habitos");
    other = await createTestUser("habitos-outro");
    db = owner.client as unknown as SupabaseClient<Database>;
    otherDb = other.client as unknown as SupabaseClient<Database>;
    await exec(
      db.from("habits").insert([
        { id: cardio, name: "Cardio", kind: "cardio", period: "week", target: 150, unit: "min", system_key: "cardio" },
        { id: abs, name: "Abdominal", kind: "check", period: "week", target: 3, system_key: "abs" },
      ]),
    );
  });

  afterAll(async () => {
    await deleteTestUser(owner);
    await deleteTestUser(other);
  });

  it("totais de cardio da semana (min, km, kcal) batem entre os logs e o week_summary", async () => {
    const logs = [
      log(cardio, "2026-10-12", { value: 30, cardio_type: "treadmill", distance_km: 4, kcal: 250 }),
      log(cardio, "2026-10-15", { value: 25, cardio_type: "bike", distance_km: 8.5 }),
      log(cardio, "2026-10-17", { value: 40, cardio_type: "run", distance_km: 6.2, kcal: 420 }), // sábado
      log(cardio, "2026-10-19", { value: 60, cardio_type: "walk", kcal: 200 }), // semana seguinte
    ];
    for (const l of logs) await upsertHabitLog(l, db);
    await upsertHabitLog(logs[0], db); // reenvio idêntico (fila offline): não duplica

    const week = await fetchHabitLogs(FROM, TO, db);
    expect(week).toHaveLength(3);
    expect(week[0]).toMatchObject({ cardio_type: "treadmill", distance_km: 4, kcal: 250, value: 30 });

    const progress = habitProgress({ kind: "cardio", period: "week", target: 150 }, week, WEEK);
    expect(progress).toMatchObject({ done: 95, target: 150, sessions: 3, distanceKm: 18.7, kcal: 670, met: false });

    const summary = await fetchWeekSummary(WEEK, db);
    expect(summary.cardio).toMatchObject({ minutes: 95, distance_km: 18.7, kcal: 670, sessions: 3, target: 150 });
  });

  it("check conta dias distintos; desfazer remove o registro", async () => {
    const sunday = log(abs, "2026-10-11");
    await upsertHabitLog(sunday, db);
    await upsertHabitLog(log(abs, "2026-10-12"), db); // segundo toque no mesmo dia
    await upsertHabitLog(log(abs, "2026-10-14"), db);
    expect((await fetchWeekSummary(WEEK, db)).abs).toMatchObject({ done: 2, target: 3 });

    await deleteHabitLogs([sunday.id], db);
    const left = (await fetchHabitLogs(FROM, TO, db)).filter((l) => l.habit_id === abs);
    expect(left).toHaveLength(2);
    expect(habitProgress({ kind: "check", period: "week", target: 3 }, left, WEEK).done).toBe(2);
  });

  it("hábito do sistema: editável, mas a exclusão é recusada com mensagem clara", async () => {
    await updateHabit(abs, { name: "Abdominal (prancha)", target: 4 }, db);
    await expect(deleteHabit(abs, db)).rejects.toMatchObject({
      name: "DataError",
      code: "P0001",
      message: "Este é um hábito do sistema: dá para editar, mas não excluir.",
    });
    const habits = await fetchHabits(db);
    expect(habits.find((h) => h.id === abs)).toMatchObject({ name: "Abdominal (prancha)", target: 4, system_key: "abs" });
  });

  it("hábito customizado: criar (idempotente), arquivar e excluir com os registros", async () => {
    const row = { id: reading, name: "Ler", kind: "quantity", period: "week", target: 60, unit: "páginas" };
    await upsertHabit(row, db);
    await upsertHabit(row, db);
    await upsertHabitLog(log(reading, "2026-10-13", { value: 20 }), db);
    expect((await fetchHabits(db)).filter((h) => h.id === reading)).toHaveLength(1);

    await updateHabit(reading, { archived_at: new Date().toISOString() }, db);
    const summary = await fetchWeekSummary(WEEK, db);
    expect((summary.habits as { id: string }[]).some((h) => h.id === reading)).toBe(false);

    await deleteHabit(reading, db);
    expect((await fetchHabits(db)).some((h) => h.id === reading)).toBe(false);
    expect((await fetchHabitLogs(FROM, TO, db)).some((l) => l.habit_id === reading)).toBe(false);
  });

  it("dias com treino finalizado (streak do Treino): só finalizados, sem repetir o dia", async () => {
    await exec(
      db.from("workouts").insert([
        { day: "2026-10-13", started_at: "2026-10-13T12:00:00Z", finished_at: "2026-10-13T13:00:00Z" },
        { day: "2026-10-13", started_at: "2026-10-13T20:00:00Z", finished_at: "2026-10-13T21:00:00Z" },
        { day: "2026-10-15", started_at: "2026-10-15T12:00:00Z", finished_at: "2026-10-15T13:00:00Z" },
        { day: "2026-10-16", started_at: "2026-10-16T12:00:00Z", finished_at: null },
      ]),
    );
    expect(await fetchTrainedDays(FROM, TO, db)).toEqual(["2026-10-13", "2026-10-15"]);
  });

  it("RLS: outro usuário não vê, não registra e não apaga os hábitos alheios", async () => {
    expect(await fetchHabits(otherDb)).toEqual([]);
    expect(await fetchHabitLogs(FROM, TO, otherDb)).toEqual([]);
    await expect(upsertHabitLog(log(cardio, "2026-10-14", { value: 10 }), otherDb)).rejects.toThrow(DataError);
    const mine = await fetchHabitLogs(FROM, TO, db);
    await deleteHabitLogs(mine.map((l) => l.id), otherDb); // sem erro, mas não apaga nada
    expect(await fetchHabitLogs(FROM, TO, db)).toHaveLength(mine.length);
  });
});

describe("tarefas", () => {
  let owner: TestUser;
  let other: TestUser;
  let db: SupabaseClient<Database>;
  let otherDb: SupabaseClient<Database>;
  const task: Task = { id: crypto.randomUUID(), title: "Comprar pão", done_at: null, created_at: "2026-10-14T10:00:00+00:00" };

  beforeAll(async () => {
    owner = await createTestUser("tarefas");
    other = await createTestUser("tarefas-outro");
    db = owner.client as unknown as SupabaseClient<Database>;
    otherDb = other.client as unknown as SupabaseClient<Database>;
  });

  afterAll(async () => {
    await deleteTestUser(owner);
    await deleteTestUser(other);
  });

  it("criar é idempotente; concluir e desfazer mudam só o done_at", async () => {
    await upsertTask(task, db);
    await upsertTask(task, db);
    expect(await fetchTasks(db)).toEqual([task]);

    await setTaskDone(task.id, "2026-10-14T11:00:00Z", db);
    expect((await fetchTasks(db))[0].done_at).toMatch(/^2026-10-14T11:00:00/);
    await setTaskDone(task.id, null, db);
    expect((await fetchTasks(db))[0]).toMatchObject({ title: "Comprar pão", done_at: null });
  });

  it("RLS: outro usuário não vê, não conclui e não exclui", async () => {
    expect(await fetchTasks(otherDb)).toEqual([]);
    await setTaskDone(task.id, new Date().toISOString(), otherDb);
    await deleteTask(task.id, otherDb);
    expect(await fetchTasks(db)).toEqual([expect.objectContaining({ id: task.id, done_at: null })]);
    // Nem consegue sequestrar o id com upsert (a linha é de outro dono).
    await expect(upsertTask({ ...task, title: "Invadido" }, otherDb)).rejects.toThrow(DataError);
    expect((await fetchTasks(db))[0].title).toBe("Comprar pão");
  });

  it("excluir remove; recriar com o mesmo id (desfazer) volta igual", async () => {
    await deleteTask(task.id, db);
    expect(await fetchTasks(db)).toEqual([]);
    await upsertTask(task, db);
    expect(await fetchTasks(db)).toEqual([task]);
  });
});
