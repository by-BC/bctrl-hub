import { describe, expect, it } from "vitest";
import { ACHIEVEMENTS, evaluateAchievements, type AchievementCtx } from "@/features/profile/domain/achievements";
import type { DayFacts } from "@/lib/domain/score";
import { addDays } from "@/lib/domain/stats";

/** Dia sem nada; `extra` liga o que o teste precisa. */
function day(d: string, extra: Partial<DayFacts> = {}): DayFacts {
  return {
    day: d,
    trained: false,
    diet: false,
    habits: false,
    tasks: false,
    score: 0,
    workouts: 0,
    volumeKg: 0,
    bestSessionKg: 0,
    prs: 0,
    mealsPlanned: 0,
    mealsDone: 0,
    ...extra,
  };
}

const workout = (d: string, sessions = 1, kg = 500) =>
  day(d, { trained: true, score: 1, workouts: sessions, volumeKg: kg * sessions, bestSessionKg: kg });

function evaluate(key: string, ctx: AchievementCtx) {
  const a = ACHIEVEMENTS.find((x) => x.key === key);
  if (!a) throw new Error(`conquista ${key} não existe`);
  return a.evaluate(ctx);
}

describe("catálogo", () => {
  it("8 conquistas, cada uma com título e regra em texto", () => {
    expect(ACHIEVEMENTS.map((a) => a.key)).toEqual([
      "first_pr",
      "training_weeks_4",
      "control_days_30",
      "session_1000kg",
      "workouts_100",
      "diet_month_80",
      "body_fat_down_1",
      "composition_goal",
    ]);
    for (const a of ACHIEVEMENTS) {
      expect(a.title.length).toBeGreaterThan(0);
      expect(a.rule.length).toBeGreaterThan(10);
    }
  });

  it("sem histórico: tudo bloqueado, com progresso 0", () => {
    const all = evaluateAchievements({ days: [], today: "2026-10-20" });
    expect(all).toHaveLength(8);
    for (const a of all) expect(a).toMatchObject({ unlockedOn: null, progress: 0, current: 0 });
  });
});

describe("composição corporal", () => {
  it("queda de gordura: bloqueada sem medição e progresso pela maior queda desde a primeira", () => {
    expect(evaluate("body_fat_down_1", { days: [], today: "2026-10-20" })).toEqual({
      unlockedOn: null, progress: 0, current: 0, target: 1,
    });
    expect(evaluate("body_fat_down_1", {
      days: [],
      today: "2026-10-20",
      measurements: [
        { day: "2026-09-01", measuredAt: "2026-09-01T10:00:00Z", bodyFatPct: 21 },
        { day: "2026-10-01", measuredAt: "2026-10-01T10:00:00Z", bodyFatPct: 20.4 },
      ],
    })).toEqual({ unlockedOn: null, progress: 0.6, current: 0.6, target: 1 });
  });

  it("queda de gordura desbloqueia na primeira medição que chega a 1 ponto percentual", () => {
    expect(evaluate("body_fat_down_1", {
      days: [],
      today: "2026-10-20",
      measurements: [
        { day: "2026-10-10", measuredAt: "2026-10-10T10:00:00Z", bodyFatPct: 19.7 },
        { day: "2026-08-01", measuredAt: "2026-08-01T10:00:00Z", bodyFatPct: 21 },
        { day: "2026-09-01", measuredAt: "2026-09-01T10:00:00Z", bodyFatPct: 20.2 },
      ],
    })).toEqual({ unlockedOn: "2026-10-10", progress: 1, current: 1, target: 1 });
  });

  it("meta de composição usa a primeira data de conclusão", () => {
    expect(evaluate("composition_goal", { days: [], today: "2026-10-20", goals: [{ achievedOn: null }] }))
      .toEqual({ unlockedOn: null, progress: 0, current: 0, target: 1 });
    expect(evaluate("composition_goal", {
      days: [], today: "2026-10-20", goals: [{ achievedOn: "2026-10-18" }, { achievedOn: "2026-09-03" }],
    })).toEqual({ unlockedOn: "2026-09-03", progress: 1, current: 1, target: 1 });
  });
});

describe("primeiro PR", () => {
  it("bloqueada sem nenhum recorde", () => {
    expect(evaluate("first_pr", { days: [workout("2026-10-01")], today: "2026-10-20" })).toEqual({
      unlockedOn: null,
      progress: 0,
      current: 0,
      target: 1,
    });
  });

  it("desbloqueia no dia do 1º PR, inclusive vindo do histórico do Hevy", () => {
    const days = [day("2026-10-01", { prs: 3 }), day("2024-03-10", { prs: 1 }), workout("2024-02-05")];
    expect(evaluate("first_pr", { days, today: "2026-10-20" })).toEqual({
      unlockedOn: "2024-03-10",
      progress: 1,
      current: 1,
      target: 1,
    });
  });
});

describe("4 semanas seguidas com a meta de treino (4 dias com treino na semana)", () => {
  /** 4 dias de treino na semana que começa em `monday` (seg, ter, qua, qui). */
  const week4 = (monday: string) => [0, 1, 2, 3].map((i) => workout(addDays(monday, i)));

  it("progresso parcial: a sequência atual conta a última semana fechada; a semana em curso não quebra", () => {
    const days = [
      ...week4("2026-09-07"),
      ...week4("2026-09-14"),
      // 4 treinos em 3 dias: a meta é de dias com treino, então não bate.
      workout("2026-09-21", 2),
      workout("2026-09-22"),
      workout("2026-09-23"),
      ...week4("2026-09-28"),
      ...week4("2026-10-05"),
      workout("2026-10-12"), // semana em curso (hoje é quarta, 14/10)
    ];
    expect(evaluate("training_weeks_4", { days, today: "2026-10-14" })).toEqual({
      unlockedOn: null,
      progress: 0.5,
      current: 2,
      target: 4,
    });
  });

  it("a semana em curso que já bateu a meta soma na sequência", () => {
    const days = [...week4("2026-09-28"), ...week4("2026-10-05"), ...week4("2026-10-12")];
    expect(evaluate("training_weeks_4", { days, today: "2026-10-16" })).toMatchObject({ unlockedOn: null, current: 3 });
  });

  it("desbloqueia no 4º dia de treino da 4ª semana seguida (histórico do Hevy de 2024)", () => {
    const days = [...week4("2024-04-01"), ...week4("2024-04-08"), ...week4("2024-04-15"), ...week4("2024-04-22")];
    expect(evaluate("training_weeks_4", { days, today: "2026-10-20" })).toEqual({
      unlockedOn: "2024-04-25",
      progress: 1,
      current: 4,
      target: 4,
    });
  });
});

describe("30 dias no controle (pontuação ≥ 3, não precisam ser seguidos)", () => {
  const control = (d: string) => day(d, { trained: true, diet: true, habits: true, score: 3 });
  const days = (n: number) => Array.from({ length: n }, (_, i) => control(addDays("2026-08-01", i * 2)));

  it("bloqueada com 29 dias: progresso 29/30", () => {
    expect(evaluate("control_days_30", { days: [...days(29), day("2026-10-19", { score: 2 })], today: "2026-10-20" }))
      .toEqual({ unlockedOn: null, progress: 29 / 30, current: 29, target: 30 });
  });

  it("desbloqueia no 30º dia", () => {
    // 30º dia: 2026-08-01 + 58 dias = 2026-09-28.
    expect(evaluate("control_days_30", { days: days(31), today: "2026-10-20" })).toEqual({
      unlockedOn: "2026-09-28",
      progress: 1,
      current: 30,
      target: 30,
    });
  });
});

describe("1.000 kg numa sessão (volume sem aquecimento)", () => {
  it("bloqueada: progresso pela melhor sessão; dois treinos no mesmo dia não somam", () => {
    const days = [workout("2026-10-01", 1, 950), workout("2026-10-02", 2, 600)];
    expect(evaluate("session_1000kg", { days, today: "2026-10-20" })).toEqual({
      unlockedOn: null,
      progress: 0.95,
      current: 950,
      target: 1000,
    });
  });

  it("desbloqueia no 1º dia com uma sessão ≥ 1.000 kg", () => {
    const days = [workout("2026-10-05", 1, 1200), workout("2025-06-10", 1, 1000), workout("2025-01-10", 1, 999.9)];
    expect(evaluate("session_1000kg", { days, today: "2026-10-20" })).toEqual({
      unlockedOn: "2025-06-10",
      progress: 1,
      current: 1200,
      target: 1000,
    });
  });
});

describe("100 treinos (contando o histórico importado do Hevy)", () => {
  // 82 treinos do Hevy (2024-02 a 2026-06), um a cada 10 dias, e depois os do app.
  const hevy = Array.from({ length: 82 }, (_, i) => workout(addDays("2024-02-01", i * 10)));

  it("só o Hevy: 82/100", () => {
    expect(evaluate("workouts_100", { days: hevy, today: "2026-10-20" })).toEqual({
      unlockedOn: null,
      progress: 0.82,
      current: 82,
      target: 100,
    });
  });

  it("desbloqueia no dia do 100º treino (dia com 2 sessões conta 2)", () => {
    const app = Array.from({ length: 9 }, (_, i) => workout(addDays("2026-09-01", i), 2)); // 18 treinos
    expect(evaluate("workouts_100", { days: [...hevy, ...app], today: "2026-10-20" })).toEqual({
      unlockedOn: "2026-09-09",
      progress: 1,
      current: 100,
      target: 100,
    });
  });
});

describe("mês com adesão ≥ 80% (mês inteiro, já fechado)", () => {
  /** Todos os dias do mês com `done` de `planned` refeições. */
  function month(start: string, days: number, planned: number, done: number) {
    return Array.from({ length: days }, (_, i) => day(addDays(start, i), { mealsPlanned: planned, mealsDone: done }));
  }

  it("bloqueada: o progresso é o melhor mês fechado; o mês em curso não conta", () => {
    const days = [...month("2026-08-01", 31, 4, 3) /* 75% */, ...month("2026-10-01", 20, 4, 4) /* 100% até hoje */];
    expect(evaluate("diet_month_80", { days, today: "2026-10-20" })).toEqual({
      unlockedOn: null,
      progress: 75 / 80,
      current: 75,
      target: 80,
    });
  });

  it("desbloqueia no último dia do 1º mês fechado com adesão ≥ 80% (soma das refeições do mês)", () => {
    // Setembro: 25 dias 4/5 (80%) + 5 dias 5/5 → 125/150 = 83%.
    const days = [...month("2026-09-01", 25, 5, 4), ...month("2026-09-26", 5, 5, 5), ...month("2026-10-01", 19, 4, 4)];
    expect(evaluate("diet_month_80", { days, today: "2026-10-20" })).toEqual({
      unlockedOn: "2026-09-30",
      progress: 1,
      current: 83,
      target: 80,
    });
  });

  it("mês sem refeições previstas não conta", () => {
    expect(evaluate("diet_month_80", { days: month("2026-08-01", 31, 0, 0), today: "2026-10-20" })).toMatchObject({
      unlockedOn: null,
      current: 0,
    });
  });
});
