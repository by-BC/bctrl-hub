import { describe, expect, it } from "vitest";
import { buildMonthCardData, monthParam, parseMonthParam, type MonthCardInput, type MonthCardSummary } from "@/features/profile/domain/month-card";

const summary = (over: Partial<MonthCardSummary> = {}): MonthCardSummary => ({
  month: "2026-10-01",
  days: 20,
  workouts: 14,
  volume_kg: 84320.5,
  prs: { count: 6 },
  control_days: 11,
  meals: { planned: 120, done: 98, pct: 82 },
  nutrition: { logged_days: 18 },
  composition: {
    count: 2,
    first: { day: "2026-10-01", weight_kg: 80, body_fat_pct: 20, skeletal_muscle_kg: 35 },
    last: { day: "2026-10-20", weight_kg: 79.2, body_fat_pct: 19.2, skeletal_muscle_kg: 35.6 },
    change: { weight_kg: -0.8, body_fat_pct: -0.8, skeletal_muscle_kg: 0.6 },
  },
  ...over,
});

const input = (over: Partial<MonthCardInput> = {}): MonthCardInput => ({
  summary: summary(),
  scores: [
    { day: "2026-10-01", score: 4 },
    { day: "2026-10-02", score: 2 },
    { day: "2026-10-15", score: 3 },
  ],
  achievements: [
    { key: "first_pr", title: "Primeiro recorde", unlockedOn: "2025-03-02" },
    { key: "control_days_30", title: "30 dias no controle", unlockedOn: "2026-10-18" },
    { key: "workouts_100", title: "100 treinos", unlockedOn: "2026-10-03" },
    { key: "diet_month_80", title: "Mês no plano", unlockedOn: null },
    { key: "session_1000kg", title: "Uma tonelada", unlockedOn: "2026-11-01" },
  ],
  today: "2026-10-20",
  ...over,
});

describe("parseMonthParam / monthParam", () => {
  it("aceita AAAA-MM e devolve o 1º dia do mês", () => {
    expect(parseMonthParam("2026-10")).toBe("2026-10-01");
    expect(parseMonthParam("2025-01")).toBe("2025-01-01");
    expect(monthParam("2026-10-01")).toBe("2026-10");
  });

  it("recusa formatos e meses inválidos", () => {
    for (const bad of ["2026-13", "2026-00", "2026-1", "2026-10-01", "outubro", "", "20261"]) {
      expect(parseMonthParam(bad), bad).toBeNull();
    }
  });
});

describe("buildMonthCardData", () => {
  it("leva os números do month_summary, o nome do mês e o ano", () => {
    const data = buildMonthCardData(input());
    expect(data).toMatchObject({
      month: "2026-10-01",
      key: "2026-10",
      monthName: "outubro",
      year: "2026",
      partial: true,
      days: 20,
      controlDays: 11,
      workouts: 14,
      volumeKg: 84320.5,
      prs: 6,
      adherence: { pct: 82, done: 98, planned: 120 },
    });
  });

  it("mês sem registro de refeição: adesão nula (\"sem registros\"), nunca 0%", () => {
    const data = buildMonthCardData(input({ summary: summary({ meals: { planned: 124, done: 0, pct: 0 }, nutrition: { logged_days: 0 } }) }));
    expect(data.adherence).toBeNull();
  });

  it("leva gordura e músculo para a linha de composição; sem medição fica nula", () => {
    expect(buildMonthCardData(input()).composition).toEqual({ bodyFatPct: -0.8, skeletalMuscleKg: 0.6 });
    expect(buildMonthCardData(input({ summary: summary({ composition: null }) })).composition).toBeNull();
  });

  it("mês fechado não é parcial", () => {
    expect(buildMonthCardData(input({ summary: summary({ month: "2026-09-01" }) })).partial).toBe(false);
  });

  it("calendário de domingo a sábado, com vazios fora do mês", () => {
    const { weeks } = buildMonthCardData(input());
    // Outubro de 2026: dia 1 numa quinta, dia 31 num sábado → 5 semanas.
    expect(weeks).toHaveLength(5);
    expect(weeks.every((w) => w.length === 7)).toBe(true);
    expect(weeks[0].slice(0, 4)).toEqual([null, null, null, null]);
    expect(weeks[0][4]).toEqual({ date: "2026-10-01", day: 1, level: 4 });
    expect(weeks[4][6]?.date).toBe("2026-10-31");
    expect(weeks.flat().filter(Boolean)).toHaveLength(31);
  });

  it("mês de 6 semanas (começa no domingo e tem 31 dias)", () => {
    // Março de 2026: dia 1 num domingo.
    const { weeks } = buildMonthCardData(input({ summary: summary({ month: "2026-03-01" }), scores: [] }));
    expect(weeks).toHaveLength(6);
    expect(weeks[0][6]?.date).toBe("2026-03-01");
  });

  it("níveis pela pontuação; dia sem linha vale 0 e o futuro fica sem nível", () => {
    const days = buildMonthCardData(input()).weeks.flat().filter((d) => d !== null);
    const level = (date: string) => days.find((d) => d.date === date)?.level;
    expect(level("2026-10-02")).toBe(2);
    expect(level("2026-10-15")).toBe(3);
    expect(level("2026-10-03")).toBe(0);
    expect(level("2026-10-20")).toBe(0); // hoje conta
    expect(level("2026-10-21")).toBeNull();
    expect(level("2026-10-31")).toBeNull();
  });

  it("conquistas: só as desbloqueadas no mês, em ordem de data", () => {
    expect(buildMonthCardData(input()).achievements).toEqual([
      { key: "workouts_100", title: "100 treinos", unlockedOn: "2026-10-03" },
      { key: "control_days_30", title: "30 dias no controle", unlockedOn: "2026-10-18" },
    ]);
    expect(buildMonthCardData(input({ achievements: [] })).achievements).toEqual([]);
  });

  it("volume que chega como texto (numeric) vira número", () => {
    const data = buildMonthCardData(input({ summary: summary({ volume_kg: "1234.5" as unknown as number }) }));
    expect(data.volumeKg).toBe(1234.5);
  });
});
