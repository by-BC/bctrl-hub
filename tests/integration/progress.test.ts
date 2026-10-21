import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  fetchBodyWeights,
  fetchExercise,
  fetchExerciseHistory,
  fetchExerciseStats,
  fetchProgressOverview,
  upsertBodyWeight,
} from "@/features/progress/api";
import { sendWorkout } from "@/features/workout-session/api";
import type { Database } from "@/lib/database.types";
import { groupExerciseHistory, listPrs, toSessionSeries } from "@/lib/domain/stats";
import { finishWorkoutSchema, type FinishWorkoutInput, type FinishWorkoutPayload, type PrKind } from "@/lib/schemas/workout";
import { createTestUser, deleteTestUser, type TestUser } from "../support/test-users";

async function exec(op: PromiseLike<{ error: unknown }>) {
  const { error } = await op;
  if (error) throw new Error(JSON.stringify(error));
}

describe("evolução: views → série do gráfico, e peso corporal", () => {
  let user: TestUser;
  let db: SupabaseClient<Database>;
  const supino = crypto.randomUUID();
  const remada = crypto.randomUUID();
  const workoutIds = [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()];

  /** Treino com séries de supino (e remada no 1º), gravado pela RPC de verdade. */
  function payload(i: number, day: string, sets: [number, number, PrKind[]?][]): FinishWorkoutPayload {
    const exercises: FinishWorkoutInput["exercises"] = [
      {
        id: crypto.randomUUID(),
        exercise_id: supino,
        sets: sets.map(([weight_kg, reps, pr_kinds = []]) => ({ id: crypto.randomUUID(), weight_kg, reps, pr_kinds })),
      },
    ];
    if (i === 0) {
      exercises.push({
        id: crypto.randomUUID(),
        exercise_id: remada,
        sets: [{ id: crypto.randomUUID(), weight_kg: 30, reps: 12, pr_kinds: [] }],
      });
    }
    return finishWorkoutSchema.parse({
      id: workoutIds[i],
      routine_id: null,
      started_at: `${day}T13:00:00Z`,
      finished_at: `${day}T14:00:00Z`,
      day,
      exercises,
    });
  }

  beforeAll(async () => {
    user = await createTestUser("evolucao");
    db = user.client as unknown as SupabaseClient<Database>;
    await exec(
      db.from("exercises").insert([
        { id: supino, name: "Supino reto", muscle_group: "Peito" },
        { id: remada, name: "Remada curvada", muscle_group: "Costas" },
      ]),
    );
    // Gravados fora de ordem: a série tem que sair cronológica.
    await sendWorkout(payload(1, "2026-10-08", [[45, 8, ["weight"]], [40, 10]]), db);
    await sendWorkout(payload(0, "2026-10-01", [[40, 10], [40, 8]]), db);
    await sendWorkout(payload(2, "2026-10-15", [[50, 5, ["weight", "e1rm"]], [45, 10, ["volume"]]]), db);
  });

  afterAll(async () => {
    await deleteTestUser(user);
  });

  it("com 3 sessões, a view devolve 3 pontos com best, 1RM e volume corretos", async () => {
    const rows = await fetchExerciseStats(supino, db);
    expect(rows).toHaveLength(3);
    const series = toSessionSeries(rows);
    expect(series.map(({ workoutId, day, weight, e1rm, volume, sets }) => ({ workoutId, day, weight, e1rm, volume, sets }))).toEqual([
      // 40×10 + 40×8 = 720; e1RM 40 × (1 + 10/30) = 53,33.
      { workoutId: workoutIds[0], day: "2026-10-01", weight: 40, e1rm: 53.33, volume: 720, sets: 2 },
      // 45×8 + 40×10 = 760; e1RM max(57; 53,33) = 57.
      { workoutId: workoutIds[1], day: "2026-10-08", weight: 45, e1rm: 57, volume: 760, sets: 2 },
      // 50×5 + 45×10 = 700; e1RM max(58,33; 60) = 60.
      { workoutId: workoutIds[2], day: "2026-10-15", weight: 50, e1rm: 60, volume: 700, sets: 2 },
    ]);
  });

  it("recordes, lista de /evolucao e histórico por sessão batem com os treinos", async () => {
    expect(await fetchExercise(supino, db)).toEqual({
      id: supino,
      name: "Supino reto",
      muscle_group: "Peito",
      exercise_type: "weight_reps",
      bests: { maxWeight: 50, maxSetVolume: 450, maxE1rm: 60 },
    });

    const overview = await fetchProgressOverview(db);
    expect(overview.find((e) => e.id === supino)).toMatchObject({ lastDay: "2026-10-15", maxWeight: 50 });
    expect(overview.find((e) => e.id === remada)).toMatchObject({ lastDay: "2026-10-01", maxWeight: 30 });

    const sessions = groupExerciseHistory(await fetchExerciseHistory(supino, db));
    expect(sessions.map((s) => [s.day, s.sets.map((x) => [Number(x.weight_kg), x.reps])])).toEqual([
      ["2026-10-15", [[50, 5], [45, 10]]],
      ["2026-10-08", [[45, 8], [40, 10]]],
      ["2026-10-01", [[40, 10], [40, 8]]],
    ]);
    expect(listPrs(sessions).map((p) => [p.day, p.weightKg, p.reps, p.kinds])).toEqual([
      ["2026-10-15", 50, 5, ["weight", "e1rm"]],
      ["2026-10-15", 45, 10, ["volume"]],
      ["2026-10-08", 45, 8, ["weight"]],
    ]);
  });

  it("exercício de outro usuário não aparece (RLS nas views)", async () => {
    const other = await createTestUser("evolucao-outro");
    try {
      const otherDb = other.client as unknown as SupabaseClient<Database>;
      expect(await fetchExerciseStats(supino, otherDb)).toEqual([]);
      expect(await fetchExercise(supino, otherDb)).toBeNull();
    } finally {
      await deleteTestUser(other);
    }
  });

  it("upsert do peso no mesmo dia atualiza em vez de duplicar", async () => {
    await upsertBodyWeight({ day: "2026-10-18", weight_kg: 82.4 }, db);
    await upsertBodyWeight({ day: "2026-10-17", weight_kg: 82.9 }, db);
    await upsertBodyWeight({ day: "2026-10-18", weight_kg: 81.95 }, db);
    // Reenvio idêntico (fila offline) também não duplica.
    await upsertBodyWeight({ day: "2026-10-18", weight_kg: 81.95 }, db);

    expect(await fetchBodyWeights(db)).toEqual([
      { day: "2026-10-17", weight_kg: 82.9, source: "manual" },
      { day: "2026-10-18", weight_kg: 81.95, source: "manual" },
    ]);
    const { count } = await db.from("body_weights").select("id", { count: "exact", head: true });
    expect(count).toBe(2);
  });
});
