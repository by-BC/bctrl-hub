import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { StateStorage } from "zustand/middleware";
import {
  fetchExerciseHistory,
  fetchLastFinishedRoutineId,
  fetchSessionSeed,
  sendWorkout,
} from "@/features/workout-session/api";
import { createActiveWorkoutStore } from "@/features/workout-session/store";
import type { Database } from "@/lib/database.types";
import { createTestUser, deleteTestUser, type TestUser } from "../support/test-users";

function memoryStorage(): StateStorage {
  const data = new Map<string, string>();
  return {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

/** Gravação sem retorno: só falha se der erro. */
async function exec(op: PromiseLike<{ error: unknown }>) {
  const { error } = await op;
  if (error) throw new Error(JSON.stringify(error));
}

async function must<T>(op: PromiseLike<{ data: T; error: unknown }>): Promise<NonNullable<T>> {
  const { data, error } = await op;
  if (error || data === null || data === undefined) throw new Error(JSON.stringify(error));
  return data;
}

describe("sessão de treino → finish_workout → views", () => {
  let user: TestUser;
  let db: SupabaseClient<Database>;
  let routineId: string;
  let supino: string;
  let remada: string;

  beforeAll(async () => {
    user = await createTestUser("sessao");
    db = user.client as unknown as SupabaseClient<Database>;
    supino = crypto.randomUUID();
    remada = crypto.randomUUID();
    routineId = crypto.randomUUID();
    await exec(
      db.from("exercises").insert([
        { id: supino, name: "Supino reto", notes: "Escápulas encaixadas" },
        { id: remada, name: "Remada curvada" },
      ]),
    );
    await exec(db.from("routines").insert({ id: routineId, name: "Upper 1", position: 1, rest_sec: 120 }));
    await exec(
      db.from("routine_exercises").insert([
        { routine_id: routineId, exercise_id: supino, position: 1, sets: 2, rest_sec: 90 },
        { routine_id: routineId, exercise_id: remada, position: 2, sets: 1, notes: "Tronco a 45°" },
      ]),
    );
  });

  afterAll(async () => {
    await deleteTestUser(user);
  });

  async function newStore() {
    const store = createActiveWorkoutStore({ storage: memoryStorage() });
    await store.persist.rehydrate();
    return store;
  }

  it("1ª sessão: sem histórico, o payload do store grava a estrutura completa", async () => {
    const seed = await fetchSessionSeed(routineId, db);
    expect(seed.routineName).toBe("Upper 1");
    expect(seed.exercises.map((e) => [e.name, e.sets, e.restSec, e.notes])).toEqual([
      ["Supino reto", 2, 90, "Escápulas encaixadas"],
      ["Remada curvada", 1, 120, "Tronco a 45°"],
    ]);
    expect(seed.exercises.every((e) => e.previous.length === 0 && e.bests === null)).toBe(true);

    const store = await newStore();
    const s = store.getState();
    s.start(seed, new Date("2026-10-13T13:00:00Z"));
    s.updateSet(0, 0, { weightKg: 40, reps: 10 });
    s.completeSet(0, 0);
    s.updateSet(0, 1, { weightKg: 45, reps: 8 });
    s.completeSet(0, 1);
    s.addSet(1); // série extra, não altera a rotina
    s.updateSet(1, 0, { weightKg: 30, reps: 12 });
    s.completeSet(1, 0);
    s.updateSet(1, 1, { weightKg: 30, reps: 10 });
    s.completeSet(1, 1);
    const local = store.getState().workout!;

    const result = await store.getState().finish((p) => sendWorkout(p, db), new Date("2026-10-13T14:00:00Z"));
    expect(result).toMatchObject({ status: "synced", workoutId: local.id });
    expect(store.getState().workout).toBeNull();

    const saved = await must(
      db
        .from("workouts")
        .select("id, routine_id, day, started_at, finished_at, workout_exercises(id, exercise_id, position, workout_sets(id, position, weight_kg, reps, pr_kinds))")
        .eq("id", local.id)
        .order("position", { referencedTable: "workout_exercises" })
        .order("position", { referencedTable: "workout_exercises.workout_sets" })
        .single(),
    );
    expect(saved.routine_id).toBe(routineId);
    expect(saved.day).toBe("2026-10-13");
    expect(Date.parse(saved.finished_at!)).toBe(Date.parse("2026-10-13T14:00:00Z"));
    expect(
      saved.workout_exercises.map((e) => ({
        id: e.id,
        exercise_id: e.exercise_id,
        position: e.position,
        sets: e.workout_sets.map((x) => [x.position, Number(x.weight_kg), x.reps, x.pr_kinds]),
      })),
    ).toEqual([
      { id: local.exercises[0].id, exercise_id: supino, position: 1, sets: [[1, 40, 10, []], [2, 45, 8, []]] },
      { id: local.exercises[1].id, exercise_id: remada, position: 2, sets: [[1, 30, 12, []], [2, 30, 10, []]] },
    ]);

    // A rotina-base continua com 1 série de remada.
    const items = await must(db.from("routine_exercises").select("sets").eq("exercise_id", remada));
    expect(items).toEqual([{ sets: 1 }]);
  });

  it("2ª sessão: o início traz o anterior e os recordes; PR detectado e gravado; views atualizadas", async () => {
    const seed = await fetchSessionSeed(routineId, db);
    const supinoSeed = seed.exercises[0];
    expect(supinoSeed.previous).toEqual([
      { weightKg: 40, reps: 10 },
      { weightKg: 45, reps: 8 },
    ]);
    // 40×10 = 400 de volume; e1RM max(53,33; 57) = 57.
    expect(supinoSeed.bests).toEqual({ maxWeight: 45, maxSetVolume: 400, maxE1rm: 57 });

    const store = await newStore();
    const s = store.getState();
    s.start(seed, new Date("2026-10-15T13:00:00Z"));
    s.updateSet(0, 0, { weightKg: 50, reps: 8 }); // carga e e1RM sobem; volume empata (400)
    s.completeSet(0, 0);
    s.completeSet(0, 1); // usa o anterior: 45 × 8
    s.completeSet(1, 0); // remada: anterior 30 × 12
    expect(store.getState().workout!.exercises[0].sets[0].prs).toEqual(["weight", "e1rm"]);

    const result = await store.getState().finish((p) => sendWorkout(p, db), new Date("2026-10-15T14:10:00Z"));
    expect(result).toMatchObject({ status: "synced", summary: { durationMin: 70, sets: 3, prs: 2 } });

    const history = await fetchExerciseHistory([supino, remada], db);
    expect(history.get(supino)).toEqual({
      previous: [
        { weightKg: 50, reps: 8 },
        { weightKg: 45, reps: 8 },
      ],
      bests: { maxWeight: 50, maxSetVolume: 400, maxE1rm: 63.33 },
    });
    expect(history.get(remada)).toEqual({
      previous: [{ weightKg: 30, reps: 12 }],
      bests: { maxWeight: 30, maxSetVolume: 360, maxE1rm: 42 },
    });

    const allSets = await must(db.from("workout_sets").select("weight_kg, pr_kinds"));
    const prSets = allSets.filter((x) => x.pr_kinds.length > 0);
    expect(prSets.map((x) => [Number(x.weight_kg), x.pr_kinds])).toEqual([[50, ["weight", "e1rm"]]]);

    expect(await fetchLastFinishedRoutineId(db)).toBe(routineId);
  });

  it("reenviar o mesmo treino (pendingSync após falha) não duplica", async () => {
    const seed = await fetchSessionSeed(routineId, db);
    const store = await newStore();
    store.getState().start(seed, new Date("2026-10-17T13:00:00Z"));
    store.getState().completeSet(0, 0);
    const id = store.getState().workout!.id;

    // O servidor gravou, mas a resposta se perdeu: o aparelho acha que falhou.
    const lostResponse = await store.getState().finish(async (p) => {
      await sendWorkout(p, db);
      throw new Error("resposta perdida");
    }, new Date("2026-10-17T14:00:00Z"));
    expect(lostResponse.status).toBe("pending");

    const retry = await store.getState().retrySync((p) => sendWorkout(p, db));
    expect(retry).toMatchObject({ status: "synced", workoutId: id });
    const rows = await must(db.from("workouts").select("id").eq("id", id));
    expect(rows).toHaveLength(1);
  });
});
