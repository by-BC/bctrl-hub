import { describe, expect, it } from "vitest";
import {
  GOAL_METRICS,
  METRIC,
  METRICS,
  PRINCIPAL,
  deltas,
  goalProgress,
  metricSeries,
  projectGoal,
  validateMeasurement,
  type MeasurementValues,
} from "@/lib/domain/composition";

describe("catálogo de métricas", () => {
  it("tem as 17 métricas, sem chave repetida, e as 5 principais na ordem do PRD", () => {
    expect(METRICS).toHaveLength(17);
    expect(new Set(METRICS.map((m) => m.key)).size).toBe(17);
    expect(PRINCIPAL).toEqual(["weight_kg", "body_fat_pct", "skeletal_muscle_kg", "visceral_fat", "lean_mass_kg"]);
    expect(METRICS.filter((m) => m.principal).map((m) => m.key)).toEqual(PRINCIPAL);
    expect(GOAL_METRICS).toEqual(["weight_kg", "body_fat_pct", "skeletal_muscle_kg", "visceral_fat"]);
  });

  it("faixas do PRD e direção desejada", () => {
    expect(METRIC.body_fat_pct).toMatchObject({ min: 2, max: 70, better: "down", unit: "%" });
    expect(METRIC.visceral_fat).toMatchObject({ min: 1, max: 60, better: "down" });
    expect(METRIC.skeletal_muscle_kg).toMatchObject({ better: "up", unit: "kg" });
    expect(METRIC.weight_kg.better).toBe("neutral");
    for (const m of METRICS) expect(m.min, m.key).toBeLessThan(m.max);
  });
});

describe("validateMeasurement", () => {
  it("medição só com peso é válida", () => {
    expect(validateMeasurement({ weight_kg: 82.4 })).toEqual([]);
  });

  it("peso é obrigatório", () => {
    expect(validateMeasurement({ body_fat_pct: 20 })).toEqual(["Informe o peso."]);
    expect(validateMeasurement({ weight_kg: null })).toEqual(["Informe o peso."]);
  });

  it("limites são inclusivos; fora da faixa dá mensagem clara com rótulo e unidade", () => {
    expect(validateMeasurement({ weight_kg: 80, body_fat_pct: 2, visceral_fat: 60 })).toEqual([]);
    expect(validateMeasurement({ weight_kg: 80, body_fat_pct: 70.1 })).toEqual(["Gordura corporal entre 2 e 70 %."]);
    expect(validateMeasurement({ weight_kg: 80, visceral_fat: 0.5 })).toEqual(["Gordura visceral entre 1 e 60."]);
    expect(validateMeasurement({ weight_kg: 10 })).toEqual(["Peso entre 20 e 300 kg."]);
  });

  it("vírgula decimal na mensagem e várias mensagens na ordem do catálogo", () => {
    expect(validateMeasurement({ weight_kg: 80, bone_kg: 0.1, fat_mass_kg: 0 })).toEqual([
      "Massa de gordura entre 0,5 e 200 kg.",
      "Massa óssea entre 0,5 e 10 kg.",
    ]);
  });

  it("número inválido e idade metabólica não inteira são recusados; nulos são ignorados", () => {
    expect(validateMeasurement({ weight_kg: Number.NaN })).toEqual(["Peso entre 20 e 300 kg."]);
    expect(validateMeasurement({ weight_kg: 80, metabolic_age: 30.5 })).toEqual(["Idade metabólica deve ser um número inteiro."]);
    expect(validateMeasurement({ weight_kg: 80, metabolic_age: null, bmi: undefined })).toEqual([]);
  });
});

type Row = { measured_at: string } & MeasurementValues;
const rows: Row[] = [
  { measured_at: "2026-06-01T07:00:00-03:00", body_fat_pct: 24, weight_kg: 86 },
  { measured_at: "2026-06-10T07:00:00-03:00", body_fat_pct: null, weight_kg: 85 },
  { measured_at: "2026-06-20T07:00:00-03:00", body_fat_pct: 23.1, weight_kg: 84.2 },
  { measured_at: "2026-06-25T21:00:00-03:00", body_fat_pct: 22.6, weight_kg: 84.5 },
];

describe("deltas e série", () => {
  it("variação contra a primeira e contra a anterior, pulando medições sem a métrica", () => {
    const d = deltas(rows, "body_fat_pct");
    expect(d.sinceFirst).toBeCloseTo(-1.4, 10);
    expect(d.sincePrev).toBeCloseTo(-0.5, 10);
    const w = deltas(rows, "weight_kg");
    expect(w.sinceFirst).toBeCloseTo(-1.5, 10);
    expect(w.sincePrev).toBeCloseTo(0.3, 10);
  });

  it("ordena pelo instante, sem depender da ordem de chegada", () => {
    const d = deltas([...rows].reverse(), "body_fat_pct");
    expect(d.sinceFirst).toBeCloseTo(-1.4, 10);
  });

  it("menos de 2 valores: sem variação", () => {
    expect(deltas(rows, "visceral_fat")).toEqual({ sinceFirst: null, sincePrev: null });
    expect(deltas(rows.slice(0, 1), "weight_kg")).toEqual({ sinceFirst: null, sincePrev: null });
  });

  it("série do gráfico: dia de São Paulo e valor, só onde a métrica existe", () => {
    expect(metricSeries(rows, "body_fat_pct")).toEqual([
      { day: "2026-06-01", value: 24 },
      { day: "2026-06-20", value: 23.1 },
      { day: "2026-06-25", value: 22.6 },
    ]);
  });
});

describe("projectGoal (regressão linear sobre todo o histórico)", () => {
  // Gordura cai 0,1 por dia: 20 (01/10), 19 (11/10), 18 (21/10). Reta: 20 − 0,1·x.
  const falling = [
    { day: "2026-10-01", value: 20 },
    { day: "2026-10-11", value: 19 },
    { day: "2026-10-21", value: 18 },
  ];

  it("alvo abaixo: 15 = 20 − 0,1·x → x = 50 → 20/11", () => {
    expect(projectGoal(falling, 15)).toEqual({ date: "2026-11-20" });
  });

  it("cruzamento fracionário arredonda para o dia seguinte: 15,05 → x = 49,5 → 20/11", () => {
    expect(projectGoal(falling, 15.05)).toEqual({ date: "2026-11-20" });
  });

  it("alvo acima: músculo 30 → 31 em 20 dias, alvo 32 → x = 40 → 10/11", () => {
    const rising = [
      { day: "2026-10-01", value: 30 },
      { day: "2026-10-11", value: 30.5 },
      { day: "2026-10-21", value: 31 },
    ];
    expect(projectGoal(rising, 32)).toEqual({ date: "2026-11-10" });
  });

  it("pontos fora da reta: (0; 10), (1; 9), (2; 9,5) → b = −0,25, a = 9,75; alvo 8 → x = 7", () => {
    const noisy = [
      { day: "2026-10-01", value: 10 },
      { day: "2026-10-02", value: 9 },
      { day: "2026-10-03", value: 9.5 },
    ];
    expect(projectGoal(noisy, 8)).toEqual({ date: "2026-10-08" });
  });

  it("usa todo o histórico e a ordem dos dias, não a de chegada", () => {
    expect(projectGoal([...falling].reverse(), 15)).toEqual({ date: "2026-11-20" });
  });

  it("away: a tendência se afasta do alvo", () => {
    expect(projectGoal(falling, 25, 22)).toEqual({ none: "away" });
  });

  it("flat: inclinação próxima de zero", () => {
    const flat = falling.map((p) => ({ ...p, value: 20 }));
    expect(projectGoal(flat, 15)).toEqual({ none: "flat" });
  });

  it("reached: o valor atual já atingiu o alvo (na direção da partida)", () => {
    expect(projectGoal(falling, 18)).toEqual({ none: "reached" });
    expect(projectGoal(falling, 18.5)).toEqual({ none: "reached" });
    // Com a partida informada (meta de subir), 18 ainda não chegou em 19.
    expect(projectGoal(falling, 19, 17)).toEqual({ none: "away" });
  });

  it("insufficient: menos de 3 medições", () => {
    expect(projectGoal([], 15)).toEqual({ none: "insufficient" });
    expect(projectGoal(falling.slice(0, 2), 15)).toEqual({ none: "insufficient" });
  });

  it("reta que já cruzou o alvo antes da última medição: projeta para o dia seguinte à última", () => {
    // Reta: b = −0,375, a = 19,75; cruza 18,4 em x = 3,6 → 05/10, o dia da última medição, que ainda está em 18,5.
    const pts = [
      { day: "2026-10-01", value: 20 },
      { day: "2026-10-03", value: 18.5 },
      { day: "2026-10-05", value: 18.5 },
    ];
    expect(projectGoal(pts, 18.4)).toEqual({ date: "2026-10-06" });
  });
});

describe("goalProgress", () => {
  it("percentual concluído da partida ao alvo, limitado a 0–100", () => {
    expect(goalProgress(22, 19, 16)).toBeCloseTo(0.5, 10);
    expect(goalProgress(30, 31, 32)).toBeCloseTo(0.5, 10);
    expect(goalProgress(22, 23, 16)).toBe(0);
    expect(goalProgress(22, 15, 16)).toBe(1);
    expect(goalProgress(16, 16, 16)).toBe(1);
  });
});
