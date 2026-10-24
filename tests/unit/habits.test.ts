import { describe, expect, it } from "vitest";
import { cardioLabel, groupByWeek, habitProgress, streak, weekTarget, type HabitLogLike } from "@/features/habits/domain/habits";
import { weekStart } from "@/lib/domain/week";
import { cardioLogFormSchema, habitFormSchema, taskTitleSchema } from "@/features/habits/schemas/habit";

const WEEK = "2026-10-19"; // segunda; domingo = 2026-10-25

const cardio = { kind: "cardio", period: "week", target: 150 } as const;
const abs = { kind: "check", period: "week", target: 3 } as const;
const supplements = { kind: "check", period: "day", target: 1 } as const;
const reading = { kind: "quantity", period: "week", target: 60 } as const;

const log = (day: string, value = 1, extra: Partial<HabitLogLike> = {}): HabitLogLike => ({ day, value, ...extra });

describe("habitProgress", () => {
  it("cardio: soma os minutos e totaliza km e kcal da semana", () => {
    const p = habitProgress(
      cardio,
      [
        log("2026-10-19", 30, { distance_km: 4, kcal: 250 }),
        log("2026-10-22", 20, { distance_km: 2.5, kcal: null }),
        log("2026-10-26", 45, { distance_km: 7, kcal: 500 }), // semana seguinte
        log("2026-10-18", 60), // semana anterior
      ],
      WEEK,
    );
    expect(p).toMatchObject({ done: 50, target: 150, pct: 33, met: false, sessions: 2, distanceKm: 6.5, kcal: 250 });
    expect(p.byDay["2026-10-19"]).toBe(30);
    expect(p.byDay["2026-10-20"]).toBe(0);
  });

  it("cardio: 30 min sobe a barra para 30/150; 150 cumpre e a barra para em 100%", () => {
    expect(habitProgress(cardio, [log("2026-10-21", 30)], WEEK)).toMatchObject({ done: 30, target: 150, pct: 20 });
    const full = habitProgress(cardio, [log("2026-10-21", 100), log("2026-10-22", 80)], WEEK);
    expect(full).toMatchObject({ done: 180, pct: 100, met: true });
  });

  it("check semanal: conta dias distintos (2 marcas no mesmo dia valem 1)", () => {
    const p = habitProgress(abs, [log("2026-10-19"), log("2026-10-19"), log("2026-10-21")], WEEK);
    expect(p).toMatchObject({ done: 2, target: 3, met: false });
    expect(habitProgress(abs, [log("2026-10-19"), log("2026-10-21"), log("2026-10-25")], WEEK).met).toBe(true);
  });

  it("check diário: meta da semana é 7 dias", () => {
    expect(weekTarget(supplements)).toBe(7);
    const p = habitProgress(supplements, [log("2026-10-19"), log("2026-10-20")], WEEK);
    expect(p).toMatchObject({ done: 2, target: 7, pct: 29, met: false });
  });

  it("quantidade: soma os valores sem erro de ponto flutuante", () => {
    const p = habitProgress(reading, [log("2026-10-20", 0.1), log("2026-10-20", 0.2), log("2026-10-23", 25)], WEEK);
    expect(p.done).toBe(25.3);
    expect(p.byDay["2026-10-20"]).toBe(0.3);
  });

  it("um log às 23h30 de domingo (dia já em São Paulo) conta na semana que termina no domingo", () => {
    expect(habitProgress(cardio, [log("2026-10-25", 30)], WEEK).done).toBe(30);
    expect(habitProgress(cardio, [log("2026-10-25", 30)], "2026-10-26").done).toBe(0);
  });
});

describe("streak", () => {
  const byWeek = (logs: HabitLogLike[]) => groupByWeek(logs, weekStart);
  const absWeek = (monday: string) => {
    const d = (n: number) => new Date(Date.parse(`${monday}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
    return [log(d(0)), log(d(2)), log(d(4))];
  };

  it("conta semanas consecutivas com a meta, até a semana falhada no meio", () => {
    const logs = [
      ...absWeek("2026-09-21"),
      log("2026-09-28"), // só 1 dia: falhou
      ...absWeek("2026-10-05"),
      ...absWeek("2026-10-12"),
      ...absWeek("2026-10-19"), // semana atual já cumprida
    ];
    expect(streak(abs, byWeek(logs), WEEK)).toBe(3);
  });

  it("a semana atual em andamento não quebra a sequência", () => {
    const logs = [...absWeek("2026-10-05"), ...absWeek("2026-10-12"), log("2026-10-19")];
    expect(streak(abs, byWeek(logs), WEEK)).toBe(2);
    // Sem nenhum registro na semana atual também não quebra.
    expect(streak(abs, byWeek([...absWeek("2026-10-12")]), WEEK)).toBe(1);
  });

  it("semana passada sem a meta zera a sequência (mesmo com semanas boas antes)", () => {
    const logs = [...absWeek("2026-10-05"), log("2026-10-12")];
    expect(streak(abs, byWeek(logs), WEEK)).toBe(0);
  });

  it("cardio: semanas de 150 min", () => {
    const logs = [log("2026-10-06", 150), log("2026-10-13", 100), log("2026-10-15", 50), log("2026-10-20", 30)];
    expect(streak(cardio, byWeek(logs), WEEK)).toBe(2);
  });
});

describe("rótulos e formulários", () => {
  it("tipos de cardio em PT, valores do banco em inglês", () => {
    expect(cardioLabel("treadmill")).toBe("Esteira");
    expect(cardioLabel("stairs")).toBe("Escada");
    expect(cardioLabel(null)).toBe("Cardio");
  });

  it("cardio: minutos obrigatórios, km e kcal opcionais (vírgula aceita)", () => {
    expect(cardioLogFormSchema.parse({ cardio_type: "run", value: "30", distance_km: "4,5", kcal: "" })).toEqual({
      cardio_type: "run",
      value: 30,
      distance_km: 4.5,
      kcal: null,
    });
    expect(cardioLogFormSchema.safeParse({ cardio_type: "run", value: "", distance_km: "", kcal: "" }).success).toBe(false);
    expect(cardioLogFormSchema.safeParse({ cardio_type: "swim", value: "30", distance_km: "", kcal: "" }).success).toBe(false);
  });

  it("hábito: check diário tem meta 1; check semanal até 7; cardio sempre em min", () => {
    expect(habitFormSchema.safeParse({ name: "Ler", kind: "check", period: "day", target: "2", unit: "" }).success).toBe(false);
    expect(habitFormSchema.safeParse({ name: "Ler", kind: "check", period: "week", target: "8", unit: "" }).success).toBe(false);
    expect(habitFormSchema.parse({ name: " Ler ", kind: "quantity", period: "week", target: "60", unit: "páginas" })).toEqual({
      name: "Ler",
      kind: "quantity",
      period: "week",
      target: 60,
      unit: "páginas",
    });
    expect(habitFormSchema.parse({ name: "Bike", kind: "cardio", period: "week", target: "90", unit: "" }).unit).toBe("min");
    expect(habitFormSchema.safeParse({ name: "", kind: "check", period: "week", target: "3", unit: "" }).success).toBe(false);
  });

  it("tarefa: título obrigatório", () => {
    expect(taskTitleSchema.safeParse("   ").success).toBe(false);
    expect(taskTitleSchema.parse("  Comprar pão ")).toBe("Comprar pão");
  });
});
