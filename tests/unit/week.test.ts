import { describe, expect, it } from "vitest";
import { addWeeks, dayKey, weekDays, weekStart } from "@/lib/domain/week";

describe("dayKey (America/Sao_Paulo)", () => {
  it("domingo 23h30 em UTC−3 ainda é domingo (já é segunda em UTC)", () => {
    // 2026-10-25 é domingo; 23h30 em São Paulo = 2026-10-26T02:30Z.
    expect(dayKey(new Date("2026-10-26T02:30:00Z"))).toBe("2026-10-25");
    expect(dayKey("2026-10-26T02:30:00Z")).toBe("2026-10-25");
    // Meia-noite em São Paulo (03h00 UTC): segunda.
    expect(dayKey(new Date("2026-10-26T03:00:00Z"))).toBe("2026-10-26");
  });
});

describe("weekStart / weekDays", () => {
  it("um log às 23h30 de domingo pertence à semana que começa nesse domingo", () => {
    const sunday = dayKey(new Date("2026-10-26T02:30:00Z"));
    expect(weekStart(sunday)).toBe("2026-10-25");
    expect(weekDays(weekStart(sunday)).at(-1)).toBe("2026-10-31");
    // Segunda-feira continua na semana iniciada no domingo anterior.
    expect(weekStart(dayKey(new Date("2026-10-26T03:00:00Z")))).toBe("2026-10-25");
    expect(weekStart("2026-11-01")).toBe("2026-11-01");
  });

  it("a semana começa no domingo e vai até o sábado", () => {
    expect(weekDays("2026-10-19")).toEqual([
      "2026-10-18",
      "2026-10-19",
      "2026-10-20",
      "2026-10-21",
      "2026-10-22",
      "2026-10-23",
      "2026-10-24",
    ]);
    // Qualquer dia da semana dá a mesma semana.
    expect(weekDays("2026-10-23")).toEqual(weekDays("2026-10-18"));
    expect(new Date("2026-10-18T12:00:00Z").getUTCDay()).toBe(0);
  });

  it("atravessa mês e ano", () => {
    expect(weekDays("2026-12-31")).toEqual([
      "2026-12-27",
      "2026-12-28",
      "2026-12-29",
      "2026-12-30",
      "2026-12-31",
      "2027-01-01",
      "2027-01-02",
    ]);
  });

  it("addWeeks anda de domingo em domingo", () => {
    expect(addWeeks("2026-10-19", -1)).toBe("2026-10-11");
    expect(addWeeks("2026-10-22", 1)).toBe("2026-10-25");
    expect(addWeeks("2027-01-04", -1)).toBe("2026-12-27");
  });
});
