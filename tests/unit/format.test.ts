import { describe, expect, it } from "vitest";
import {
  formatClock,
  formatCompact,
  formatShortDay,
  formatDay,
  formatDuration,
  formatElapsed,
  formatKg,
  kgInputValue,
  parseDecimal,
  parseReps,
  durationInputValue,
  formatDistance,
  formatSeconds,
  formatSet,
  kmInputValue,
  parseDuration,
  parseKm,
} from "@/lib/format";

describe("format", () => {
  it("carga e volume em pt-BR", () => {
    expect(formatKg(52.5)).toBe("52,5");
    expect(formatKg(12345)).toBe("12.345");
  });

  it("relógios e durações", () => {
    expect(formatClock(90)).toBe("1:30");
    expect(formatClock(-3)).toBe("0:00");
    expect(formatClock(4.2)).toBe("0:05");
    expect(formatElapsed(65_000)).toBe("1:05");
    expect(formatElapsed(3_725_000)).toBe("1:02:05");
    expect(formatDuration(45)).toBe("45 min");
    expect(formatDuration(65)).toBe("1 h 05 min");
  });

  it("dia sem escorregar de fuso", () => {
    expect(formatDay("2026-10-13")).toMatch(/13 de out/);
  });

  it("campos numéricos aceitam vírgula e rejeitam lixo", () => {
    expect(parseDecimal("52,5")).toBe(52.5);
    expect(parseDecimal("")).toBeNull();
    expect(parseDecimal("abc")).toBeNull();
    expect(parseDecimal("-1")).toBeNull();
    expect(parseReps("8")).toBe(8);
    expect(parseReps("8,5")).toBeNull();
    expect(parseReps("0")).toBeNull();
    expect(kgInputValue(52.5)).toBe("52,5");
    expect(kgInputValue(null)).toBe("");
  });
});

describe("formatShortDay e formatCompact (eixos dos gráficos)", () => {
  it("dia curto sem ponto, com ano opcional", () => {
    expect(formatShortDay("2026-10-13")).toBe("13 out");
    expect(formatShortDay("2026-01-01", { year: true })).toBe("1 jan 26");
  });

  it("compacta a partir de mil", () => {
    expect(formatCompact(82.5)).toBe("82,5");
    expect(formatCompact(1250).replace(/\s/g, " ")).toBe("1,3 mil"); // Intl usa espaço inseparável
  });
});

describe("format v2: duração, distância e série por tipo", () => {
  it("duração digitada: segundos, m:ss ou h:mm:ss", () => {
    expect(parseDuration("60")).toBe(60);
    expect(parseDuration("1:30")).toBe(90);
    expect(parseDuration("12:00")).toBe(720);
    expect(parseDuration("1:02:05")).toBe(3725);
    expect(parseDuration("")).toBeNull();
    expect(parseDuration("0")).toBeNull();
    expect(parseDuration("1:75")).toBeNull();
    expect(parseDuration("1,5")).toBeNull();
    expect(parseDuration("a:10")).toBeNull();
    expect(durationInputValue(90)).toBe("1:30");
    expect(durationInputValue(null)).toBe("");
    expect(formatSeconds(3725)).toBe("1:02:05");
  });

  it("distância em km no campo, metros no banco", () => {
    expect(parseKm("2")).toBe(2000);
    expect(parseKm("2,5")).toBe(2500);
    expect(parseKm("0,04")).toBe(40);
    expect(parseKm("0")).toBeNull();
    expect(parseKm("x")).toBeNull();
    expect(kmInputValue(2500)).toBe("2,5");
    expect(kmInputValue(null)).toBe("");
    expect(formatDistance(2000)).toBe("2 km");
    expect(formatDistance(2550)).toBe("2,55 km");
    expect(formatDistance(40)).toBe("40 m");
  });

  it("texto da série conforme o tipo do exercício", () => {
    const s = (weightKg: number | null, reps: number | null, distanceM: number | null = null, durationS: number | null = null) => ({
      weightKg,
      reps,
      distanceM,
      durationS,
    });
    expect(formatSet(s(60, 10), "weight_reps")).toBe("60 kg × 10");
    expect(formatSet(s(40, 10), "weight_reps", { unit: false })).toBe("40 × 10");
    expect(formatSet(s(null, 12), "reps_only")).toBe("12 reps");
    expect(formatSet(s(10, 8), "bodyweight_reps")).toBe("+10 kg × 8");
    expect(formatSet(s(null, 8), "bodyweight_reps")).toBe("8 reps");
    expect(formatSet(s(20, 8), "bodyweight_assisted_reps")).toBe("−20 kg × 8");
    expect(formatSet(s(null, null, null, 60), "duration")).toBe("1:00");
    expect(formatSet(s(12, null, null, 45), "weight_duration")).toBe("12 kg · 0:45");
    expect(formatSet(s(null, null, 2000, 720), "distance_duration")).toBe("2 km · 12:00");
    expect(formatSet(s(32, null, 40), "short_distance_weight")).toBe("32 kg · 40 m");
    expect(formatSet(s(null, null), "duration")).toBe("—");
  });
});
