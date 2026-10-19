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
