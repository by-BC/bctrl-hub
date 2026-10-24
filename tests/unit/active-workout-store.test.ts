import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ACTIVE_WORKOUT_STORAGE_KEY,
  createActiveWorkoutStore,
  NothingToFinishError,
  previousFor,
  SyncError,
  toFinishPayload,
  type SessionSeed,
} from "@/features/workout-session/store";
import { finishWorkoutSchema, type FinishWorkoutPayload } from "@/features/workout-session/schemas/workout";

const SEED_ID = "0cc175b9-c0f1-b6a8-31c3-99e269772661"; // formato dos ids do seed (md5)
const supino = crypto.randomUUID();
const remada = crypto.randomUUID();

function seed(): SessionSeed {
  return {
    routineId: SEED_ID,
    routineName: "Treino A",
    exercises: [
      {
        exerciseId: supino,
        name: "Supino reto",
        restSec: 90,
        notes: "Escápulas encaixadas",
        sets: 3,
        previous: [
          { weightKg: 50, reps: 10 },
          { weightKg: 50, reps: 9 },
        ],
        bests: { maxWeight: 50, maxSetVolume: 500, maxE1rm: 66.67 },
      },
      { exerciseId: remada, name: "Remada curvada", restSec: 120, notes: null, sets: 2, previous: [], bests: null },
    ],
  };
}

const T0 = new Date("2026-10-13T13:00:00.000Z"); // 10h em São Paulo

async function freshStore() {
  const store = createActiveWorkoutStore();
  await store.persist.rehydrate();
  return store;
}

beforeEach(() => localStorage.clear());
afterEach(() => vi.useRealTimers());

describe("useActiveWorkout: início", () => {
  it("monta a sessão a partir da rotina, com o anterior e os recordes guardados", async () => {
    const store = await freshStore();
    store.getState().start(seed(), T0);
    const w = store.getState().workout!;
    expect(w.status).toBe("active");
    expect(w.startedAt).toBe(T0.toISOString());
    expect(w.routineId).toBe(SEED_ID);
    expect(w.exercises.map((e) => e.sets.length)).toEqual([3, 2]);
    expect(w.exercises[0].previous[0]).toEqual({ weightKg: 50, reps: 10 });
    expect(w.exercises[0].bests).toEqual({ maxWeight: 50, maxSetVolume: 500, maxE1rm: 66.67 });
    expect(w.exercises[0].sets[0]).toMatchObject({ weightKg: null, reps: null, done: false, prs: [] });
    expect(w.rest).toBeNull();
  });

  it("não começa outra sessão por cima de uma em andamento", async () => {
    const store = await freshStore();
    store.getState().start(seed(), T0);
    const id = store.getState().workout!.id;
    store.getState().start({ routineId: null, routineName: null, exercises: [] }, T0);
    expect(store.getState().workout!.id).toBe(id);
  });
});

describe("useActiveWorkout: séries e timer", () => {
  it("completeSet marca a série e inicia o timer por endsAt (descanso do exercício)", async () => {
    const store = await freshStore();
    store.getState().start(seed(), T0);
    store.getState().updateSet(0, 0, { weightKg: 55, reps: 10 });
    const now = T0.getTime() + 5 * 60_000;
    expect(store.getState().completeSet(0, 0, now)).toBe(true);

    const w = store.getState().workout!;
    expect(w.exercises[0].sets[0].done).toBe(true);
    expect(w.rest).toEqual({ endsAt: new Date(now + 90_000).toISOString(), durationSec: 90 });
  });

  it("concluir sem digitar usa o valor anterior da mesma série (2 toques: digitar e ✓)", async () => {
    const store = await freshStore();
    store.getState().start(seed(), T0);
    store.getState().completeSet(0, 1, T0.getTime());
    expect(store.getState().workout!.exercises[0].sets[1]).toMatchObject({ weightKg: 50, reps: 9, done: true });
  });

  it("série sem valores e sem anterior não é concluída", async () => {
    const store = await freshStore();
    store.getState().start(seed(), T0);
    expect(store.getState().completeSet(1, 0, T0.getTime())).toBe(false);
    expect(store.getState().workout!.exercises[1].sets[0].done).toBe(false);
    expect(store.getState().workout!.rest).toBeNull();
  });

  it("detecta o PR ao concluir e desfaz ao desmarcar", async () => {
    const store = await freshStore();
    store.getState().start(seed(), T0);
    store.getState().updateSet(0, 0, { weightKg: 55, reps: 10 });
    store.getState().completeSet(0, 0, T0.getTime());
    expect(store.getState().workout!.exercises[0].sets[0].prs).toEqual(["weight", "volume", "e1rm"]);

    store.getState().completeSet(0, 0, T0.getTime()); // desmarca
    expect(store.getState().workout!.exercises[0].sets[0]).toMatchObject({ done: false, prs: [] });
  });

  it("editar a carga de uma série concluída recalcula o PR", async () => {
    const store = await freshStore();
    store.getState().start(seed(), T0);
    store.getState().updateSet(0, 0, { weightKg: 45, reps: 10 });
    store.getState().completeSet(0, 0, T0.getTime());
    expect(store.getState().workout!.exercises[0].sets[0].prs).toEqual([]);
    store.getState().updateSet(0, 0, { weightKg: 60 });
    expect(store.getState().workout!.exercises[0].sets[0].prs).toEqual(["weight", "volume", "e1rm"]);
  });

  it("adjustRest soma ±15 s ao endsAt e pular encerra o timer", async () => {
    const store = await freshStore();
    store.getState().start(seed(), T0);
    store.getState().completeSet(0, 1, T0.getTime());
    const endsAt = Date.parse(store.getState().workout!.rest!.endsAt);

    store.getState().adjustRest(15, T0.getTime());
    expect(Date.parse(store.getState().workout!.rest!.endsAt)).toBe(endsAt + 15_000);
    store.getState().adjustRest(-15, T0.getTime());
    store.getState().adjustRest(-15, T0.getTime());
    expect(Date.parse(store.getState().workout!.rest!.endsAt)).toBe(endsAt - 15_000);

    // Tirar mais do que resta encerra o descanso.
    store.getState().adjustRest(-600, T0.getTime());
    expect(store.getState().workout!.rest).toBeNull();

    store.getState().completeSet(0, 0, T0.getTime());
    store.getState().skipRest();
    expect(store.getState().workout!.rest).toBeNull();
  });
});

describe("useActiveWorkout: adicionar e remover não altera a rotina-base", () => {
  it("addSet copia a última série (sem concluir) e addExercise entra no fim, sem mexer no seed", async () => {
    const base = seed();
    const snapshot = structuredClone(base);
    const store = await freshStore();
    store.getState().start(base, T0);

    store.getState().updateSet(1, 1, { weightKg: 30, reps: 12 });
    store.getState().addSet(1);
    const sets = store.getState().workout!.exercises[1].sets;
    expect(sets).toHaveLength(3);
    expect(sets[2]).toMatchObject({ weightKg: 30, reps: 12, done: false, prs: [] });
    expect(new Set(sets.map((s) => s.id)).size).toBe(3);

    const extra = crypto.randomUUID();
    store.getState().addExercise({
      exerciseId: extra,
      name: "Elevação lateral",
      restSec: 60,
      notes: null,
      sets: 3,
      previous: [],
      bests: null,
    });
    store.getState().removeSet(0, 2);
    store.getState().removeExercise(1);

    const w = store.getState().workout!;
    expect(w.exercises.map((e) => e.name)).toEqual(["Supino reto", "Elevação lateral"]);
    expect(w.exercises[0].sets).toHaveLength(2);
    expect(base).toEqual(snapshot); // rotina-base intacta
  });
});

describe("useActiveWorkout: persistência", () => {
  it("reidrata a sessão inteira (séries e timer) após recarregar", async () => {
    const first = await freshStore();
    first.getState().start(seed(), T0);
    first.getState().updateSet(0, 0, { weightKg: 55, reps: 10 });
    first.getState().completeSet(0, 0, T0.getTime());

    expect(localStorage.getItem(ACTIVE_WORKOUT_STORAGE_KEY)).toContain("Supino reto");

    // "Reload": outro store lendo o mesmo localStorage.
    const second = await freshStore();
    expect(second.getState().workout).toEqual(first.getState().workout);
    expect(second.getState().workout!.rest!.endsAt).toBe(new Date(T0.getTime() + 90_000).toISOString());
  });

  it("discard limpa o aparelho", async () => {
    const store = await freshStore();
    store.getState().start(seed(), T0);
    store.getState().discard();
    expect(store.getState().workout).toBeNull();
    const reloaded = await freshStore();
    expect(reloaded.getState().workout).toBeNull();
  });
});

describe("payload de finish_workout", () => {
  it("gera payload válido: só séries concluídas, exercício sem série concluída fica de fora", async () => {
    const store = await freshStore();
    store.getState().start(seed(), T0);
    store.getState().updateSet(0, 0, { weightKg: 55, reps: 10 });
    store.getState().completeSet(0, 0, T0.getTime());
    store.getState().updateSet(0, 1, { weightKg: 42.5, reps: 8 });
    store.getState().completeSet(0, 1, T0.getTime());
    store.getState().updateSet(0, 2, { weightKg: 40, reps: 8 }); // não concluída

    const w = store.getState().workout!;
    const finishedAt = new Date(T0.getTime() + 65 * 60_000).toISOString();
    const payload = toFinishPayload(w, finishedAt);

    expect(finishWorkoutSchema.safeParse(payload).success).toBe(true);
    expect(payload).toMatchObject({
      id: w.id,
      routine_id: SEED_ID,
      started_at: T0.toISOString(),
      finished_at: finishedAt,
      day: "2026-10-13",
    });
    expect(payload.exercises).toHaveLength(1);
    expect(payload.exercises[0]).toMatchObject({ id: w.exercises[0].id, exercise_id: supino });
    expect(payload.exercises[0].sets).toEqual([
      {
        id: w.exercises[0].sets[0].id,
        set_type: "normal",
        weight_kg: 55,
        reps: 10,
        distance_m: null,
        duration_s: null,
        pr_kinds: ["weight", "volume", "e1rm"],
      },
      {
        id: w.exercises[0].sets[1].id,
        set_type: "normal",
        weight_kg: 42.5,
        reps: 8,
        distance_m: null,
        duration_s: null,
        pr_kinds: [],
      },
    ]);
  });

  it("sem nenhuma série concluída não dá para finalizar", async () => {
    const store = await freshStore();
    store.getState().start(seed(), T0);
    await expect(store.getState().finish(vi.fn(), T0)).rejects.toBeInstanceOf(NothingToFinishError);
    expect(store.getState().workout!.status).toBe("active");
  });
});

describe("finalizar e pendingSync", () => {
  async function storeWithOneSet() {
    const store = await freshStore();
    store.getState().start(seed(), T0);
    store.getState().completeSet(0, 0, T0.getTime());
    return store;
  }
  const finishedAt = new Date(T0.getTime() + 60 * 60_000);

  it("com sucesso, envia o payload e só então limpa o aparelho", async () => {
    const store = await storeWithOneSet();
    const id = store.getState().workout!.id;
    const send = vi.fn(async (p: FinishWorkoutPayload) => p.id);

    const result = await store.getState().finish(send, finishedAt);

    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0].finished_at).toBe(finishedAt.toISOString());
    expect(result).toEqual({
      status: "synced",
      workoutId: id,
      summary: { durationMin: 60, sets: 1, volumeKg: 500, prs: 0 },
    });
    expect(store.getState().workout).toBeNull();
    expect((await freshStore()).getState().workout).toBeNull();
  });

  it("sem rede, a sessão fica pendingSync (persistida) e o reenvio usa o mesmo payload", async () => {
    const store = await storeWithOneSet();
    const failing = vi.fn(async () => {
      throw new SyncError("Sem conexão.", true);
    });

    const result = await store.getState().finish(failing, finishedAt);
    expect(result.status).toBe("pending");
    const pending = store.getState().workout!;
    expect(pending.status).toBe("pendingSync");
    expect(pending.finishedAt).toBe(finishedAt.toISOString());
    expect(pending.rest).toBeNull();
    expect(pending.sync).toMatchObject({ attempts: 1, retryable: true, error: "Sem conexão." });

    // Recarregou a página: continua pendente.
    const reloaded = await freshStore();
    expect(reloaded.getState().workout!.status).toBe("pendingSync");

    // Rede voltou: reenvia com o mesmo id e finished_at e limpa.
    const send = vi.fn(async (p: FinishWorkoutPayload) => p.id);
    const retry = await reloaded.getState().retrySync(send);
    expect(retry.status).toBe("synced");
    expect(send.mock.calls[0][0].id).toBe(pending.id);
    expect(send.mock.calls[0][0].finished_at).toBe(finishedAt.toISOString());
    expect(reloaded.getState().workout).toBeNull();
  });

  it("erro do banco (não de rede) fica pendente mas sem reenvio automático", async () => {
    const store = await storeWithOneSet();
    const result = await store.getState().finish(async () => {
      throw new SyncError("Sessão expirada.", false);
    }, finishedAt);
    expect(result.status).toBe("pending");
    expect(store.getState().workout!.sync).toMatchObject({ retryable: false, error: "Sessão expirada." });
  });

  it("tentativas simultâneas viram um envio só", async () => {
    const store = await storeWithOneSet();
    await store.getState().finish(async () => {
      throw new SyncError("Sem conexão.", true);
    }, finishedAt);
    let resolve!: (id: string) => void;
    const send = vi.fn(() => new Promise<string>((r) => (resolve = r)));
    const a = store.getState().retrySync(send);
    const b = store.getState().retrySync(send);
    resolve(store.getState().workout!.id);
    await Promise.all([a, b]);
    expect(send).toHaveBeenCalledTimes(1);
  });
});

// ── v2: campos por tipo de exercício e aquecimento ────────────────────────

describe("useActiveWorkout: tipos de exercício", () => {
  const prancha = crypto.randomUUID();
  const corrida = crypto.randomUUID();

  function typedSeed(): SessionSeed {
    return {
      routineId: null,
      routineName: null,
      exercises: [
        {
          exerciseId: prancha,
          name: "Prancha",
          exerciseType: "duration",
          restSec: 60,
          notes: null,
          sets: 2,
          previous: [{ weightKg: null, reps: null, durationS: 50 }],
          bests: { maxDurationS: 50 },
        },
        {
          exerciseId: corrida,
          name: "Corrida",
          exerciseType: "distance_duration",
          restSec: 0,
          notes: null,
          sets: 1,
          previous: [],
          bests: null,
        },
      ],
    };
  }

  it("guarda o tipo do exercício; sem tipo no seed, carga × reps", async () => {
    const store = await freshStore();
    store.getState().start(typedSeed(), T0);
    expect(store.getState().workout!.exercises.map((e) => e.exerciseType)).toEqual(["duration", "distance_duration"]);
    store.getState().discard();
    store.getState().start(seed(), T0);
    expect(store.getState().workout!.exercises[0].exerciseType).toBe("weight_reps");
    expect(store.getState().workout!.exercises[0].sets[0]).toMatchObject({ setType: "normal", durationS: null, distanceM: null });
  });

  it("prancha: conclui pela duração (ou pelo anterior) e detecta PR de duração", async () => {
    const store = await freshStore();
    store.getState().start(typedSeed(), T0);
    store.getState().updateSet(0, 0, { durationS: 60 });
    expect(store.getState().completeSet(0, 0, T0.getTime())).toBe(true);
    expect(store.getState().workout!.exercises[0].sets[0].prs).toEqual(["duration"]);

    // Sem anterior para a 2ª série e sem valor: não conclui.
    expect(store.getState().completeSet(0, 1, T0.getTime())).toBe(false);
  });

  it("concluir sem digitar usa o anterior também na duração", async () => {
    const store = await freshStore();
    store.getState().start(typedSeed(), T0);
    expect(store.getState().completeSet(0, 0, T0.getTime())).toBe(true);
    expect(store.getState().workout!.exercises[0].sets[0]).toMatchObject({ durationS: 50, done: true, prs: [] });
  });

  it("corrida: distância e duração vão para o payload; campos de fora do tipo, não", async () => {
    const store = await freshStore();
    store.getState().start(typedSeed(), T0);
    store.getState().updateSet(1, 0, { distanceM: 2000, durationS: 720, reps: 3 });
    store.getState().completeSet(1, 0, T0.getTime());
    store.getState().updateSet(0, 0, { durationS: 60 });
    store.getState().completeSet(0, 0, T0.getTime());

    const payload = toFinishPayload(store.getState().workout!, new Date(T0.getTime() + 30 * 60_000).toISOString());
    const id = expect.any(String);
    expect(payload.exercises.map((e) => e.sets)).toEqual([
      [{ id, set_type: "normal", weight_kg: null, reps: null, distance_m: null, duration_s: 60, pr_kinds: ["duration"] }],
      [{ id, set_type: "normal", weight_kg: null, reps: null, distance_m: 2000, duration_s: 720, pr_kinds: [] }],
    ]);
  });

  it("marcar como aquecimento: some do PR e do volume, vai no payload como warmup", async () => {
    const store = await freshStore();
    store.getState().start(seed(), T0);
    store.getState().updateSet(0, 0, { weightKg: 60, reps: 10 });
    store.getState().completeSet(0, 0, T0.getTime());
    expect(store.getState().workout!.exercises[0].sets[0].prs).toEqual(["weight", "volume", "e1rm"]);

    store.getState().toggleWarmup(0, 0);
    const w = store.getState().workout!;
    expect(w.exercises[0].sets[0]).toMatchObject({ setType: "warmup", prs: [] });
    expect(toFinishPayload(w, T0.toISOString()).exercises[0].sets[0]).toMatchObject({ set_type: "warmup", pr_kinds: [] });

    store.getState().toggleWarmup(0, 0);
    expect(store.getState().workout!.exercises[0].sets[0]).toMatchObject({ setType: "normal", prs: ["weight", "volume", "e1rm"] });
  });

  it("o anterior acompanha as séries de trabalho: aquecimento não desloca a coluna", async () => {
    const store = await freshStore();
    store.getState().start(seed(), T0);
    store.getState().toggleWarmup(0, 0);
    const exercise = store.getState().workout!.exercises[0];
    expect(previousFor(exercise, 0)).toBeUndefined();
    expect(previousFor(exercise, 1)).toEqual({ weightKg: 50, reps: 10 });
    expect(previousFor(exercise, 2)).toEqual({ weightKg: 50, reps: 9 });

    // Aquecimento concluído sem digitar não pega o anterior das séries de trabalho.
    expect(store.getState().completeSet(0, 0, T0.getTime())).toBe(false);
    expect(store.getState().completeSet(0, 1, T0.getTime())).toBe(true);
    expect(store.getState().workout!.exercises[0].sets[1]).toMatchObject({ weightKg: 50, reps: 10 });
  });

  it("sessão salva na v1 (sem tipos) é migrada ao reidratar", async () => {
    const v1 = {
      state: {
        workout: {
          id: crypto.randomUUID(),
          routineId: null,
          routineName: null,
          startedAt: T0.toISOString(),
          exercises: [
            {
              id: crypto.randomUUID(),
              exerciseId: supino,
              name: "Supino reto",
              restSec: 90,
              notes: null,
              previous: [{ weightKg: 50, reps: 10 }],
              bests: { maxWeight: 50, maxSetVolume: 500, maxE1rm: 66.67 },
              sets: [{ id: crypto.randomUUID(), weightKg: 55, reps: 10, done: true, prs: ["weight"] }],
            },
          ],
          rest: null,
          status: "active",
          finishedAt: null,
          sync: null,
        },
      },
      version: 1,
    };
    localStorage.setItem(ACTIVE_WORKOUT_STORAGE_KEY, JSON.stringify(v1));
    const store = await freshStore();
    const e = store.getState().workout!.exercises[0];
    expect(e.exerciseType).toBe("weight_reps");
    expect(e.sets[0]).toMatchObject({ setType: "normal", distanceM: null, durationS: null, weightKg: 55 });
    expect(toFinishPayload(store.getState().workout!, T0.toISOString()).exercises[0].sets).toHaveLength(1);
  });
});
