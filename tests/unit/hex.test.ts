import { describe, expect, it } from "vitest";
import {
  HEX_SEGMENT_LENGTH,
  HEX_SEGMENT_LENGTHS,
  HEX_SEGMENT_POINTS,
  clampProgress,
  habitsProgress,
  polylineLength,
  segmentFill,
  toPct,
  weekHex,
} from "@/lib/domain/hex";

const L = HEX_SEGMENT_LENGTH;

describe("geometria do Hex", () => {
  it("os 3 segmentos têm o mesmo comprimento (≈ 2 lados de 70)", () => {
    expect(L).toBeCloseTo(140, 0);
    expect(polylineLength(HEX_SEGMENT_POINTS.meals)).toBeCloseTo(L, 1);
    expect(polylineLength(HEX_SEGMENT_POINTS.habits)).toBeCloseTo(L, 1);
    expect(HEX_SEGMENT_LENGTHS.meals).toBe(polylineLength(HEX_SEGMENT_POINTS.meals));
  });
});

describe("segmentFill", () => {
  it("0: nada preenchido (offset = comprimento inteiro)", () => {
    expect(segmentFill(0)).toEqual({ progress: 0, filled: 0, dashArray: `${L} ${L}`, dashOffset: L });
  });

  it("0,5: metade do segmento", () => {
    const fill = segmentFill(0.5);
    expect(fill.progress).toBe(0.5);
    expect(fill.filled).toBeCloseTo(L / 2);
    expect(fill.dashOffset).toBeCloseTo(L / 2);
  });

  it("1: segmento cheio (offset 0)", () => {
    expect(segmentFill(1)).toMatchObject({ progress: 1, filled: L, dashOffset: 0 });
  });

  it("acima de 1 é limitado a 1", () => {
    expect(segmentFill(1.8)).toEqual(segmentFill(1));
  });

  it("negativo (ou NaN) vira 0", () => {
    expect(segmentFill(-0.3)).toEqual(segmentFill(0));
    expect(segmentFill(Number.NaN)).toEqual(segmentFill(0));
  });

  it("aceita outro comprimento (outros tamanhos de desenho)", () => {
    expect(segmentFill(0.25, 100)).toEqual({ progress: 0.25, filled: 25, dashArray: "100 100", dashOffset: 75 });
  });

  it("clampProgress e toPct", () => {
    expect(clampProgress(0.42)).toBe(0.42);
    expect(clampProgress(Infinity)).toBe(0);
    expect(toPct(0.456)).toBe(46);
    expect(toPct(3)).toBe(100);
  });
});

describe("habitsProgress (média dos hábitos)", () => {
  it("média simples de cardio min/150, abdominal x/3 e suplementos dias/7", () => {
    const { progress, parts } = habitsProgress({
      cardio: { minutes: 75, target: 150 },
      abs: { done: 3, target: 3 },
      supplements: { done: 0, target: 7 },
    });
    expect(parts.map((p) => [p.key, p.ratio])).toEqual([
      ["cardio", 0.5],
      ["abs", 1],
      ["supplements", 0],
    ]);
    expect(progress).toBeCloseTo(0.5);
  });

  it("passar da meta num hábito não compensa outro (cada um limitado a 1)", () => {
    const { progress } = habitsProgress({
      cardio: { minutes: 450, target: 150 },
      abs: { done: 0, target: 3 },
      supplements: { done: 0, target: 7 },
    });
    expect(progress).toBeCloseTo(1 / 3);
  });

  it("sem meta no banco usa a padrão; hábito ausente sai da média", () => {
    const { progress, parts } = habitsProgress({
      cardio: null,
      abs: { done: 1, target: null },
      supplements: { done: 7, target: null },
    });
    expect(parts.map((p) => [p.key, p.target])).toEqual([
      ["abs", 3],
      ["supplements", 7],
    ]);
    expect(progress).toBeCloseTo((1 / 3 + 1) / 2);
  });

  it("sem nenhum hábito do sistema: 0", () => {
    expect(habitsProgress({ cardio: null, abs: null, supplements: null }).progress).toBe(0);
  });
});

describe("weekHex", () => {
  it("2/4 treinos = metade do azul; adesão % vira 0–1", () => {
    const hex = weekHex({
      workouts: { done: 2, target: 4 },
      meals: { pct: 68 },
      cardio: { minutes: 0, target: 150 },
      abs: { done: 0, target: 3 },
      supplements: { done: 0, target: 7 },
    });
    expect(hex.workouts).toBe(0.5);
    expect(hex.meals).toBe(0.68);
    expect(hex.habits).toBe(0);
  });

  it("5/4 treinos fica cheio, não transborda", () => {
    const hex = weekHex({
      workouts: { done: 5, target: 4 },
      meals: { pct: 0 },
      cardio: null,
      abs: null,
      supplements: null,
    });
    expect(hex.workouts).toBe(1);
  });
});
