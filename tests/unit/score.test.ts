import { describe, expect, it } from "vitest";
import {
  CONTROL_MIN_SCORE,
  CRITERIA,
  heatmapLevel,
  isControlDay,
  metCriteria,
  scoreChunks,
  scoreOf,
  toDayFacts,
  type Criteria,
} from "@/lib/domain/score";
import { addMonths, monthEnd, monthStart } from "@/lib/domain/week";

const KEYS = ["trained", "diet", "habits", "tasks"] as const;

/** As 16 combinações dos 4 critérios (bit i = critério i). */
const combos: Criteria[] = Array.from({ length: 16 }, (_, n) => ({
  trained: (n & 1) !== 0,
  diet: (n & 2) !== 0,
  habits: (n & 4) !== 0,
  tasks: (n & 8) !== 0,
}));

describe("scoreOf: 1 ponto por critério cumprido", () => {
  it.each(combos.map((c, n) => [n, c] as const))("combinação %i", (_n, c) => {
    const expected = KEYS.filter((k) => c[k]).length;
    expect(scoreOf(c)).toBe(expected);
    // Nível do heatmap = pontuação.
    expect(heatmapLevel(scoreOf(c))).toBe(expected);
    // Critérios cumpridos, na ordem do catálogo, com rótulo em texto (não só cor).
    expect(metCriteria(c)).toEqual(CRITERIA.filter((x) => c[x.key]).map((x) => x.label));
  });

  it("dia no controle = pontuação ≥ 3", () => {
    expect(CONTROL_MIN_SCORE).toBe(3);
    expect(combos.filter((c) => isControlDay({ score: scoreOf(c) }))).toHaveLength(5); // 4 com 3 pontos + 1 com 4
    expect(isControlDay({ score: 2 })).toBe(false);
  });
});

describe("heatmapLevel", () => {
  it("fica entre 0 e 4 (valores fora da faixa ou inválidos são limitados)", () => {
    expect(heatmapLevel(-1)).toBe(0);
    expect(heatmapLevel(7)).toBe(4);
    expect(heatmapLevel(Number.NaN)).toBe(0);
    expect(heatmapLevel(2.6)).toBe(2);
  });
});

describe("toDayFacts", () => {
  it("converte a linha da RPC (numeric pode vir como texto) e recalcula a pontuação pelos critérios", () => {
    expect(
      toDayFacts({
        day: "2026-09-07",
        trained: true,
        diet: true,
        habits: false,
        tasks: true,
        score: 3,
        workouts: 1,
        volume_kg: "1000.50" as unknown as number,
        best_session_kg: 1000.5,
        prs: 2,
        meals_planned: 5,
        meals_done: 5,
      }),
    ).toEqual({
      day: "2026-09-07",
      trained: true,
      diet: true,
      habits: false,
      tasks: true,
      score: 3,
      workouts: 1,
      volumeKg: 1000.5,
      bestSessionKg: 1000.5,
      prs: 2,
      mealsPlanned: 5,
      mealsDone: 5,
    });
  });
});

describe("scoreChunks: o histórico inteiro em pedaços de até 400 dias", () => {
  it("intervalo curto: 1 pedaço", () => {
    expect(scoreChunks("2026-10-01", "2026-10-20")).toEqual([["2026-10-01", "2026-10-20"]]);
  });

  it("2024-02-01 → 2026-10-20 (993 dias): 3 pedaços contíguos, sem sobreposição", () => {
    const chunks = scoreChunks("2024-02-01", "2026-10-20");
    expect(chunks).toEqual([
      ["2024-02-01", "2025-03-06"],
      ["2025-03-07", "2026-04-10"],
      ["2026-04-11", "2026-10-20"],
    ]);
  });

  it("início depois do fim: nenhum pedaço", () => {
    expect(scoreChunks("2026-10-21", "2026-10-20")).toEqual([]);
  });
});

describe("mês (AAAA-MM-01)", () => {
  it("monthStart, monthEnd e addMonths, inclusive em fevereiro bissexto e na virada do ano", () => {
    expect(monthStart("2026-09-30")).toBe("2026-09-01");
    expect(monthEnd("2026-09-12")).toBe("2026-09-30");
    expect(monthEnd("2028-02-10")).toBe("2028-02-29");
    expect(addMonths("2026-01-15", -1)).toBe("2025-12-01");
    expect(addMonths("2026-12-01", 1)).toBe("2027-01-01");
  });
});
