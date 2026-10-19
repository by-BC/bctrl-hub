import { describe, expect, it } from "vitest";
import { STORY_MAX_EXERCISES, buildStoryData, type StoryWeekInput, type StoryWorkoutInput } from "@/lib/domain/story";

const set = (weightKg: number, reps: number, prs: string[] = []) => ({ weightKg, reps, prs });

const workout = (over: Partial<StoryWorkoutInput> = {}): StoryWorkoutInput => ({
  routineName: "Upper 1",
  day: "2026-10-14",
  startedAt: "2026-10-14T13:00:00Z",
  finishedAt: "2026-10-14T14:12:40Z",
  exercises: [
    { name: "Supino reto", sets: [set(60, 10), set(70, 8, ["weight", "e1rm"]), set(70, 6)] },
    { name: "Remada curvada", sets: [set(50, 12), set(50, 12)] },
  ],
  ...over,
});

const week: StoryWeekInput = {
  workouts: { done: 3, target: 4 },
  meals: { pct: 82 },
  cardio: { minutes: 75, target: 150 },
  abs: { done: 3, target: 3 },
  supplements: { done: 7, target: 7 },
  days: [
    { day: "2026-10-12", trained: true },
    { day: "2026-10-13", trained: false },
    { day: "2026-10-14", trained: true },
  ],
};

describe("buildStoryData", () => {
  it("cabeçalho: rotina, dia, duração (minutos inteiros) e séries", () => {
    const data = buildStoryData(workout(), week);
    expect(data.routineName).toBe("Upper 1");
    expect(data.date).toBe("2026-10-14");
    expect(data.durationMin).toBe(72);
    expect(data.setsCount).toBe(5);
  });

  it("treino sem rotina vira 'Treino livre'", () => {
    expect(buildStoryData(workout({ routineName: null }), null).routineName).toBe("Treino livre");
  });

  it("melhor série = maior carga; no empate, mais repetições", () => {
    const data = buildStoryData(workout(), week);
    expect(data.exercises[0].best).toEqual({ kg: 70, reps: 8 });
    expect(data.exercises[1].best).toEqual({ kg: 50, reps: 12 });
  });

  it("sem carga (peso do corpo): a melhor é a de mais repetições", () => {
    const data = buildStoryData(
      workout({ exercises: [{ name: "Barra fixa", sets: [set(0, 8), set(0, 12), set(0, 10)] }] }),
      null,
    );
    expect(data.exercises[0].best).toEqual({ kg: 0, reps: 12 });
    expect(data.volumeKg).toBe(0);
  });

  it("volume total e por exercício (kg × reps), séries de cada exercício na ordem", () => {
    const data = buildStoryData(workout(), week);
    // 600 + 560 + 420 = 1580; 600 + 600 = 1200
    expect(data.exercises[0].volumeKg).toBe(1580);
    expect(data.exercises[1].volumeKg).toBe(1200);
    expect(data.volumeKg).toBe(2780);
    expect(data.exercises[0].sets.map((s) => [s.kg, s.reps])).toEqual([
      [60, 10],
      [70, 8],
      [70, 6],
    ]);
  });

  it("arredonda o volume para kg inteiros e o 1RM estimado para 1 casa", () => {
    const data = buildStoryData(
      workout({
        exercises: [{ name: "Rosca", sets: [set(12.25, 3), set(12.75, 9, ["e1rm"])] }],
      }),
      null,
    );
    // 36,75 + 114,75 = 151,5 → 152
    expect(data.volumeKg).toBe(152);
    expect(data.exercises[0].volumeKg).toBe(152);
    // Epley: 12,75 × (1 + 9/30) = 16,575 → 16,6
    expect(data.prs).toEqual([{ exercise: "Rosca", kind: "e1rm", kg: 12.75, reps: 9, value: 16.6 }]);
  });

  it("ignora séries inválidas (0 reps) e exercícios sem nenhuma série que conte", () => {
    const data = buildStoryData(
      workout({
        exercises: [
          { name: "Supino", sets: [set(60, 10), set(80, 0)] },
          { name: "Vazio", sets: [set(20, 0)] },
        ],
      }),
      null,
    );
    expect(data.exercises.map((e) => e.name)).toEqual(["Supino"]);
    expect(data.exercises[0].best).toEqual({ kg: 60, reps: 10 });
    expect(data.setsCount).toBe(1);
  });

  it("PRs: um por exercício e tipo (o maior valor), na ordem dos exercícios e com o valor do recorde", () => {
    const data = buildStoryData(
      workout({
        exercises: [
          { name: "Supino", sets: [set(70, 8, ["weight", "volume"]), set(72.5, 5, ["weight"])] },
          { name: "Remada", sets: [set(50, 12)] },
          { name: "Agachamento", sets: [set(100, 10, ["volume"])] },
        ],
      }),
      null,
    );
    expect(data.prs).toEqual([
      { exercise: "Supino", kind: "weight", kg: 72.5, reps: 5, value: 72.5 },
      { exercise: "Supino", kind: "volume", kg: 70, reps: 8, value: 560 },
      { exercise: "Agachamento", kind: "volume", kg: 100, reps: 10, value: 1000 },
    ]);
    expect(data.exercises.map((e) => e.hasPr)).toEqual([true, false, true]);
    expect(data.exercises[0].sets.map((s) => s.prs)).toEqual([["weight", "volume"], ["weight"]]);
  });

  it("treino sem PR: lista vazia e nenhum exercício marcado", () => {
    const data = buildStoryData(
      workout({ exercises: [{ name: "Supino", sets: [set(60, 10), set(60, 10)] }] }),
      week,
    );
    expect(data.prs).toEqual([]);
    expect(data.exercises.every((e) => !e.hasPr)).toBe(true);
  });

  it(`até ${STORY_MAX_EXERCISES} exercícios aparecem todos`, () => {
    const exercises = Array.from({ length: STORY_MAX_EXERCISES }, (_, i) => ({ name: `E${i + 1}`, sets: [set(10, 10)] }));
    const data = buildStoryData(workout({ exercises }), null);
    expect(data.exercises).toHaveLength(STORY_MAX_EXERCISES);
    expect(data.hiddenExercises).toBe(0);
  });

  it("muitos exercícios: mostra os primeiros e resume o resto em '+N' (totais e PRs contam todos)", () => {
    const exercises = Array.from({ length: 9 }, (_, i) => ({
      name: `E${i + 1}`,
      sets: [set(10, 10, i === 8 ? ["weight"] : [])],
    }));
    const data = buildStoryData(workout({ exercises }), null);
    // A linha "+N" ocupa a última vaga: 5 exercícios + "+4".
    expect(data.exercises.map((e) => e.name)).toEqual(["E1", "E2", "E3", "E4", "E5"]);
    expect(data.hiddenExercises).toBe(4);
    expect(data.volumeKg).toBe(900);
    expect(data.setsCount).toBe(9);
    expect(data.prs).toEqual([{ exercise: "E9", kind: "weight", kg: 10, reps: 10, value: 10 }]);
  });

  it("semana: treinos x/meta, adesão e hábitos em % inteiros, progresso dos 3 segmentos e dias treinados", () => {
    const data = buildStoryData(workout(), week);
    // Hábitos: (75/150 + 3/3 + 7/7) / 3 = 0,8333 → 83%
    expect(data.week).toEqual({
      workouts: 3,
      workoutsTarget: 4,
      mealsPct: 82,
      habitsPct: 83,
      progress: { workouts: 0.75, meals: 0.82, habits: expect.closeTo(0.8333, 3) },
      days: week.days,
    });
  });

  it("sem resumo da semana: week = null", () => {
    expect(buildStoryData(workout(), null).week).toBeNull();
  });

  it("treino sem horário de fim: duração 0", () => {
    expect(buildStoryData(workout({ finishedAt: null }), null).durationMin).toBe(0);
  });
});
