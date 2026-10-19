import { describe, expect, it } from "vitest";
import { dayInSaoPaulo } from "@/lib/domain/day";

describe("dayInSaoPaulo", () => {
  it("usa o fuso de São Paulo (UTC−3), não o UTC", () => {
    // 23h30 em São Paulo de 13/10 já é 14/10 em UTC.
    expect(dayInSaoPaulo(new Date("2026-10-14T02:30:00Z"))).toBe("2026-10-13");
    expect(dayInSaoPaulo(new Date("2026-10-14T03:00:00Z"))).toBe("2026-10-14");
  });

  it("aceita string ISO", () => {
    expect(dayInSaoPaulo("2026-01-01T12:00:00Z")).toBe("2026-01-01");
  });
});
