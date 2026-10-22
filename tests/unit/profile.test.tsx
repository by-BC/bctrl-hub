import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { MonthNumbers, MonthSummary } from "@/features/profile/api";
import { Achievements, progressText } from "@/features/profile/components/achievements";
import { blockStyle, dayDescription } from "@/features/profile/components/control-heatmap";
import { prValueText } from "@/features/profile/components/month-records";
import { summaryStats } from "@/features/profile/summary-stats";
import type { AchievementView } from "@/lib/domain/achievements";
import {
  canGoNextMonth,
  controlText,
  heatColor,
  heatmapDays,
  heatmapMonths,
  heatmapRange,
  monthDelta,
  monthLabel,
  monthShort,
} from "@/lib/domain/month-view";
import type { MonthNutrition } from "@/lib/domain/nutrition";
import type { DayScore } from "@/lib/domain/score";

const score = (day: string, c: Partial<Omit<DayScore, "day" | "score">>): DayScore => {
  const crit = { trained: false, diet: false, habits: false, tasks: false, ...c };
  return { day, ...crit, score: Object.values(crit).filter(Boolean).length as DayScore["score"] };
};

describe("heatmap: pontuação → nível e cor", () => {
  it("a janela vai do 1º dia de 11 meses atrás até hoje", () => {
    expect(heatmapRange("2026-10-20")).toEqual({ from: "2025-11-01", to: "2026-10-20" });
    expect(heatmapRange("2026-01-31")).toEqual({ from: "2025-02-01", to: "2026-01-31" });
  });

  it("um dia por data, nível = pontuação, sem linha = 0 e nada depois de hoje", () => {
    const days = heatmapDays(
      [
        score("2026-10-02", { trained: true }),
        score("2026-10-03", { trained: true, tasks: true }),
        score("2026-10-04", { trained: true, diet: true, tasks: true }),
        score("2026-10-05", { trained: true, diet: true, habits: true, tasks: true }),
        score("2026-10-09", { trained: true }), // depois de `to`: ignorado
      ],
      "2026-10-01",
      "2026-10-05",
    );
    expect(days.map((d) => [d.date, d.level])).toEqual([
      ["2026-10-01", 0],
      ["2026-10-02", 1],
      ["2026-10-03", 2],
      ["2026-10-04", 3],
      ["2026-10-05", 4],
    ]);
    expect(days.every((d) => d.count === d.level)).toBe(true);
    expect(days[2].criteria).toEqual(["Treino ou cardio", "Tarefa concluída"]);
    expect(days[0].criteria).toEqual([]);
  });

  it("cada nível usa o seu token de cor (um conjunto por tema no CSS)", () => {
    expect([0, 1, 2, 3, 4].map(heatColor)).toEqual([
      "var(--heat-0)",
      "var(--heat-1)",
      "var(--heat-2)",
      "var(--heat-3)",
      "var(--heat-4)",
    ]);
    // Fora da faixa, preso a 0–4.
    expect(heatColor(-1)).toBe("var(--heat-0)");
    expect(heatColor(9)).toBe("var(--heat-4)");
  });

  it("o quadrado pinta pelo token e ganha contorno quando está em destaque", () => {
    expect(blockStyle(2, false)).toMatchObject({ fill: "var(--heat-2)", stroke: "var(--heat-stroke)", strokeWidth: 1 });
    expect(blockStyle(4, true, { stroke: "x" })).toMatchObject({ fill: "var(--heat-4)", stroke: "var(--foreground)", strokeWidth: 2 });
  });

  it("o rótulo do dia diz data, pontuação e critérios (sem depender da cor)", () => {
    expect(dayDescription({ date: "2026-10-13", count: 2, criteria: ["Treino ou cardio", "Tarefa concluída"] })).toBe(
      "ter., 13 de out. de 2026: 2 de 4 pontos (Treino ou cardio, Tarefa concluída)",
    );
    expect(dayDescription({ date: "2026-10-14", count: 0, criteria: [] })).toMatch(/0 de 4 pontos \(nenhum critério cumprido\)$/);
  });

  it("resumo por mês: dias no controle (≥ 3), dias com ponto e o texto", () => {
    const days = heatmapDays(
      [
        score("2026-09-30", { trained: true, diet: true, tasks: true }),
        score("2026-10-01", { trained: true }),
        score("2026-10-02", { trained: true, diet: true, habits: true }),
      ],
      "2026-09-29",
      "2026-10-03",
    );
    expect(heatmapMonths(days)).toEqual([
      { month: "2026-09-01", days: 2, control: 1, scored: 1 },
      { month: "2026-10-01", days: 3, control: 1, scored: 2 },
    ]);
    expect(controlText(18, 31)).toBe("18 de 31 dias no controle");
    expect(controlText(0, 1)).toBe("0 de 1 dia no controle");
  });
});

describe("mês: rótulos e navegação", () => {
  it("nomes em português", () => {
    expect(monthLabel("2026-10-01")).toBe("outubro de 2026");
    expect(monthShort("2026-09-01")).toBe("set");
  });

  it("não passa do mês de hoje", () => {
    expect(canGoNextMonth("2026-09-01", "2026-10-20")).toBe(true);
    expect(canGoNextMonth("2026-10-01", "2026-10-20")).toBe(false);
  });
});

describe("variação contra o mês anterior", () => {
  const int = (n: number) => String(Math.round(n));

  it("positiva, negativa e igual, sempre com texto", () => {
    expect(monthDelta(12, 9, "set", int)).toEqual({ direction: "up", text: "+3 vs set" });
    expect(monthDelta(7, 9, "set", (n) => `${n} kg`)).toEqual({ direction: "down", text: "−2 kg vs set" });
    expect(monthDelta(9, 9, "set", int)).toEqual({ direction: "same", text: "igual a set" });
    // Diferença que arredonda para zero é "igual".
    expect(monthDelta(9.2, 9, "set", int)).toEqual({ direction: "same", text: "igual a set" });
  });

  it("sem base no mês anterior e sem número no mês atual", () => {
    expect(monthDelta(80, null, "set", int)).toEqual({ direction: "none", text: "sem base em set" });
    expect(monthDelta(null, 80, "set", int)).toEqual({ direction: "none", text: "sem comparação" });
  });
});

function numbers(month: string, extra: Partial<MonthNumbers> = {}): MonthNumbers {
  return {
    month,
    days: 30,
    workouts: 0,
    volume_kg: 0,
    prs: { count: 0, list: [] },
    control_days: 0,
    meals: { planned: 90, done: 0, pct: 0 },
    cardio: { minutes: 0, distance_km: 0, sessions: 0 },
    nutrition: { logged_days: 0, training_days: 0, options: [], off_plan: { kcal: 0, protein: 0, carbs: 0, fat: 0 } },
    composition: null,
    ...extra,
  };
}

const logged = (days: number) => ({
  logged_days: days,
  training_days: 0,
  options: [],
  off_plan: { kcal: 0, protein: 0, carbs: 0, fat: 0 },
});

const nutrition = (kcal: number | null, goal: number | null): MonthNutrition => ({
  days: kcal === null ? 0 : 10,
  consumed: kcal === null ? null : { kcal, protein: 150, carbs: 0, fat: 0 },
  goal: goal === null ? null : { kcal: goal, protein: 160, carbs: 0, fat: 0 },
  unresolved: 0,
});

const byKey = (stats: ReturnType<typeof summaryStats>) => Object.fromEntries(stats.map((s) => [s.key, s]));

describe("resumo do mês", () => {
  it("mês do Hevy (sem nenhum registro de refeição): adesão e nutrição 'sem registros', nunca 0%", () => {
    const summary: MonthSummary = {
      month: "2025-03-01",
      current: numbers("2025-03-01", { workouts: 6, volume_kg: 30500.4, days: 31 }),
      previous: numbers("2025-02-01", { workouts: 4, volume_kg: 20000 }),
    };
    const s = byKey(summaryStats(summary, null));
    expect(s.workouts.value).toEqual({ kind: "number", text: "6" });
    expect(s.workouts.delta).toEqual({ direction: "up", text: "+2 vs fev" });
    expect(s.volume.value).toEqual({ kind: "number", text: "30.500", unit: "kg" });
    expect(s.volume.delta.text).toBe("+10.500 kg vs fev");
    for (const key of ["adherence", "kcal", "protein"]) {
      expect(s[key].value).toEqual({ kind: "empty" });
      expect(s[key].delta.direction).toBe("none");
    }
    expect(s.control.detail).toBe("de 31 dias");
  });

  it("mês anterior sem registros: a adesão de agora não tem base", () => {
    const summary: MonthSummary = {
      month: "2026-10-01",
      current: numbers("2026-10-01", { meals: { planned: 40, done: 30, pct: 75 }, nutrition: logged(10) }),
      previous: numbers("2026-09-01"),
    };
    const s = byKey(summaryStats(summary, { current: nutrition(2150, 2400), previous: nutrition(null, null) }));
    expect(s.adherence.value).toEqual({ kind: "number", text: "75", unit: "%" });
    expect(s.adherence.delta).toEqual({ direction: "none", text: "sem base em set" });
    expect(s.kcal.value).toEqual({ kind: "number", text: "2.150", unit: "kcal" });
    expect(s.kcal.detail).toBe("meta 2.400 kcal");
    expect(s.kcal.delta.text).toBe("sem base em set");
  });

  it("com registros nos dois meses: variação em p.p. e meta ausente sinalizada", () => {
    const summary: MonthSummary = {
      month: "2026-10-01",
      current: numbers("2026-10-01", { meals: { planned: 40, done: 30, pct: 75 }, nutrition: logged(10) }),
      previous: numbers("2026-09-01", { meals: { planned: 40, done: 32, pct: 80 }, nutrition: logged(12) }),
    };
    const s = byKey(summaryStats(summary, { current: nutrition(2150, null), previous: nutrition(2000, null) }));
    expect(s.adherence.delta).toEqual({ direction: "down", text: "−5 p.p. vs set" });
    expect(s.kcal.delta).toEqual({ direction: "up", text: "+150 kcal vs set" });
    expect(s.kcal.missingGoal).toBe(true);
    // Nutrição ainda calculando: esqueleto só nesses dois cartões.
    const loading = byKey(summaryStats(summary, null));
    expect(loading.kcal.value).toEqual({ kind: "loading" });
    expect(loading.workouts.value.kind).toBe("number");
  });
});

describe("recordes e conquistas", () => {
  it("valor do recorde com a unidade do tipo", () => {
    expect(prValueText({ kind: "weight", value: 72.5 })).toBe("72,5 kg");
    expect(prValueText({ kind: "volume", value: 1000 })).toBe("1.000 kg");
    expect(prValueText({ kind: "e1rm", value: 96.67 })).toBe("96,67 kg");
    expect(prValueText({ kind: "duration", value: 90 })).toBe("1:30");
    expect(prValueText({ kind: "distance", value: 2500 })).toBe("2,5 km");
  });

  const view = (key: string, title: string, extra: Partial<AchievementView>): AchievementView => ({
    key,
    title,
    rule: `Regra de ${title}`,
    unlockedOn: null,
    progress: 0,
    current: 0,
    target: 1,
    ...extra,
  });

  it("progresso em texto com a unidade da meta", () => {
    expect(progressText({ key: "workouts_100", current: 82, target: 100 })).toBe("82 de 100 treinos");
    expect(progressText({ key: "session_1000kg", current: 640.5, target: 1000 })).toBe("640 de 1.000 kg");
    expect(progressText({ key: "diet_month_80", current: 62, target: 80 })).toBe("62% de 80%");
    expect(progressText({ key: "body_fat_down_1", current: 0.6, target: 1 })).toBe("0,6 de 1 p.p.");
  });

  it("desbloqueada (ícone + data) e bloqueada (regra + barra) com rótulos distintos", () => {
    render(
      <Achievements
        items={[
          view("workouts_100", "100 treinos", { current: 82, target: 100, progress: 0.82 }),
          view("first_pr", "Primeiro recorde", { unlockedOn: "2024-03-05", progress: 1, current: 1 }),
        ]}
      />,
    );
    const items = within(screen.getByRole("list", { name: "Conquistas" })).getAllByRole("listitem");
    // Desbloqueadas primeiro.
    expect(items[0]).toHaveAttribute("data-state", "unlocked");
    expect(items[0]).toHaveTextContent("Primeiro recorde");
    expect(items[0]).toHaveTextContent("Desbloqueada em 5 mar 24");
    expect(within(items[0]).queryByRole("progressbar")).toBeNull();

    expect(items[1]).toHaveAttribute("data-state", "locked");
    expect(items[1]).toHaveTextContent("Bloqueada");
    expect(items[1]).toHaveTextContent("Regra de 100 treinos");
    const bar = within(items[1]).getByRole("progressbar", { name: "Progresso de 100 treinos" });
    expect(bar).toHaveAttribute("aria-valuenow", "82");
    expect(bar).toHaveAttribute("aria-valuetext", "82 de 100 treinos");
    expect(screen.queryByText(/Nenhuma conquista ainda/)).toBeNull();
  });

  it("sem nenhuma desbloqueada: estado vazio em texto", () => {
    render(<Achievements items={[view("first_pr", "Primeiro recorde", {})]} />);
    expect(screen.getByText(/Nenhuma conquista ainda/)).toBeInTheDocument();
  });
});
