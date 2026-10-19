import { describe, expect, it } from "vitest";
import {
  addDays,
  dayToTime,
  filterByRange,
  groupExerciseHistory,
  lastDayByExercise,
  listPrs,
  movingAverage,
  niceAxis,
  rangeStart,
  toSessionSeries,
  type ExerciseOccurrenceRow,
  type SessionStatRow,
} from "@/lib/domain/stats";

describe("datas puras", () => {
  it("dayToTime é meia-noite UTC e addDays atravessa mês e ano", () => {
    expect(new Date(dayToTime("2026-10-13")).toISOString()).toBe("2026-10-13T00:00:00.000Z");
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
  });
});

describe("movingAverage", () => {
  it("janela maior que os dados: usa os registros que existem", () => {
    const result = movingAverage(
      [
        { day: "2026-10-01", value: 80 },
        { day: "2026-10-02", value: 81 },
        { day: "2026-10-03", value: 82 },
      ],
      7,
    );
    expect(result.map((p) => p.average)).toEqual([80, 80.5, 81]);
  });

  it("dias faltando não contam como zero e saem da janela pelo calendário", () => {
    const result = movingAverage(
      [
        { day: "2026-10-01", value: 80 },
        { day: "2026-10-05", value: 82 },
        // 08/10: a janela de 7 dias vai de 02/10 a 08/10, então 01/10 sai.
        { day: "2026-10-08", value: 84 },
        // 20/10: nenhum registro nos 6 dias anteriores.
        { day: "2026-10-20", value: 79 },
      ],
      7,
    );
    expect(result.map((p) => [p.day, p.average])).toEqual([
      ["2026-10-01", 80],
      ["2026-10-05", 81],
      ["2026-10-08", 83],
      ["2026-10-20", 79],
    ]);
  });

  it("ordena por dia, arredonda em 2 casas e traz o eixo de tempo", () => {
    const result = movingAverage(
      [
        { day: "2026-10-03", value: 80.1 },
        { day: "2026-10-01", value: 80 },
        { day: "2026-10-02", value: 80.2 },
      ],
      7,
    );
    expect(result.map((p) => p.day)).toEqual(["2026-10-01", "2026-10-02", "2026-10-03"]);
    expect(result[2].average).toBe(80.1);
    expect(result[0].t).toBe(dayToTime("2026-10-01"));
  });

  it("janela 1 é o próprio valor; janela inválida é erro", () => {
    expect(movingAverage([{ day: "2026-10-01", value: 80 }], 1)[0].average).toBe(80);
    expect(() => movingAverage([], 0)).toThrow(RangeError);
    expect(movingAverage([], 7)).toEqual([]);
  });
});

describe("toSessionSeries", () => {
  const row = (over: Partial<SessionStatRow>): SessionStatRow => ({
    workout_id: "w",
    day: "2026-10-01",
    started_at: "2026-10-01T13:00:00Z",
    best_weight: 40,
    best_e1rm: 53.33,
    volume: 720,
    sets: 2,
    ...over,
  });

  it("vira pontos em ordem cronológica, com números e eixo de tempo", () => {
    const series = toSessionSeries([
      row({ workout_id: "b", day: "2026-10-08", best_weight: 45, best_e1rm: 57, volume: 760, sets: 2 }),
      row({ workout_id: "a", day: "2026-10-01" }),
    ]);
    expect(series).toEqual([
      { workoutId: "a", day: "2026-10-01", t: dayToTime("2026-10-01"), weight: 40, e1rm: 53.33, volume: 720, sets: 2 },
      { workoutId: "b", day: "2026-10-08", t: dayToTime("2026-10-08"), weight: 45, e1rm: 57, volume: 760, sets: 2 },
    ]);
  });

  it("dois treinos no mesmo dia seguem a hora de início; linhas incompletas saem", () => {
    const series = toSessionSeries([
      row({ workout_id: "tarde", started_at: "2026-10-01T20:00:00Z" }),
      row({ workout_id: "manha", started_at: "2026-10-01T10:00:00Z" }),
      row({ workout_id: null }),
      row({ workout_id: "sem-carga", best_weight: null }),
    ]);
    expect(series.map((p) => p.workoutId)).toEqual(["manha", "tarde"]);
  });
});

describe("filtro de período", () => {
  const points = ["2026-06-01", "2026-07-21", "2026-07-22", "2026-09-19", "2026-09-20", "2026-10-18"].map((day) => ({
    day,
  }));

  it("1 mês = últimos 30 dias contando hoje", () => {
    expect(rangeStart("1m", "2026-10-18")).toBe("2026-09-19");
    expect(filterByRange(points, "1m", "2026-10-18").map((p) => p.day)).toEqual([
      "2026-09-19",
      "2026-09-20",
      "2026-10-18",
    ]);
  });

  it("3 meses = últimos 90 dias", () => {
    expect(rangeStart("3m", "2026-10-18")).toBe("2026-07-21");
    expect(filterByRange(points, "3m", "2026-10-18").map((p) => p.day)).toEqual([
      "2026-07-21",
      "2026-07-22",
      "2026-09-19",
      "2026-09-20",
      "2026-10-18",
    ]);
  });

  it("tudo devolve todos, sem dias no futuro", () => {
    expect(rangeStart("all", "2026-10-18")).toBeNull();
    expect(filterByRange([...points, { day: "2026-10-19" }], "all", "2026-10-18")).toHaveLength(points.length);
  });
});

describe("histórico e recordes do exercício", () => {
  const workout = (id: string, day: string, finished = true) => ({
    id,
    day,
    started_at: `${day}T13:00:00Z`,
    finished_at: finished ? `${day}T14:00:00Z` : null,
    routine: { name: "Upper 1" },
  });
  const set = (id: string, position: number, weight_kg: number, reps: number, pr_kinds: string[] = []) => ({
    id,
    position,
    weight_kg,
    reps,
    pr_kinds,
  });

  const rows: ExerciseOccurrenceRow[] = [
    { id: "we1", position: 1, workout: workout("w1", "2026-10-01"), workout_sets: [set("s2", 2, 40, 8), set("s1", 1, 40, 10)] },
    { id: "we3", position: 3, workout: workout("w2", "2026-10-08"), workout_sets: [set("s5", 1, 50, 5, ["weight"])] },
    { id: "we2", position: 1, workout: workout("w2", "2026-10-08"), workout_sets: [set("s3", 1, 45, 8, ["weight", "e1rm"])] },
    { id: "we4", position: 1, workout: workout("w3", "2026-10-10", false), workout_sets: [set("s9", 1, 99, 1)] },
    { id: "we5", position: 1, workout: null, workout_sets: [] },
  ];

  it("agrupa por treino finalizado, mais recente primeiro, com as séries em ordem", () => {
    const sessions = groupExerciseHistory(rows);
    expect(sessions.map((s) => [s.workoutId, s.sets.map((x) => x.id)])).toEqual([
      ["w2", ["s3", "s5"]],
      ["w1", ["s1", "s2"]],
    ]);
    expect(sessions[0].routineName).toBe("Upper 1");
  });

  it("lista só as séries com PR", () => {
    expect(listPrs(groupExerciseHistory(rows))).toEqual([
      { setId: "s3", workoutId: "w2", day: "2026-10-08", weightKg: 45, reps: 8, kinds: ["weight", "e1rm"] },
      { setId: "s5", workoutId: "w2", day: "2026-10-08", weightKg: 50, reps: 5, kinds: ["weight"] },
    ]);
  });

  it("último dia treinado por exercício", () => {
    const last = lastDayByExercise([
      { exercise_id: "a", day: "2026-10-01" },
      { exercise_id: "a", day: "2026-10-08" },
      { exercise_id: "b", day: "2026-09-01" },
      { exercise_id: null, day: "2026-10-09" },
    ]);
    expect(Object.fromEntries(last)).toEqual({ a: "2026-10-08", b: "2026-09-01" });
  });
});

describe("niceAxis", () => {
  it("arredonda o domínio para passos redondos, com até 5 marcas", () => {
    expect(niceAxis([81.95, 84.1])).toEqual({ domain: [81, 85], ticks: [81, 82, 83, 84, 85] });
    expect(niceAxis([30, 47.5])).toEqual({ domain: [30, 50], ticks: [30, 35, 40, 45, 50] });
    expect(niceAxis([250, 760])).toEqual({ domain: [200, 800], ticks: [200, 400, 600, 800] });
    expect(niceAxis([700, 720, 760])).toEqual({ domain: [700, 760], ticks: [700, 720, 740, 760] });
  });

  it("valor único ganha folga; sem valores, um domínio neutro", () => {
    expect(niceAxis([50])).toEqual({ domain: [46, 54], ticks: [46, 48, 50, 52, 54] });
    expect(niceAxis([])).toEqual({ domain: [0, 1], ticks: [0, 1] });
  });
});
