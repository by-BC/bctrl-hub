import { createElement } from "react";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { goalFormErrors, goalView, projectionText } from "@/features/composition/goals-view";
import { bmrSourceText } from "@/features/profile/bmr-view";
import { BmrSourceLine, BreakdownSteps } from "@/features/profile/components/profile-form";
import {
  bmrInputFrom,
  goalReached,
  latestValue,
  newlyAchieved,
  type GoalLike,
  type MeasurementLike,
} from "@/features/composition/domain/composition";
import { bmrChoice, goalsFromProfile, type CompleteProfile } from "@/features/nutrition/domain/nutrition";

/** Task 4.0 v3: metas de composição (progresso, projeção, conclusão) e a fonte da TMB nas metas nutricionais. */

const m = (day: string, values: Record<string, number | null>): MeasurementLike => ({
  measured_at: `${day}T07:00:00-03:00`,
  day,
  ...values,
});

const goal = (over: Partial<GoalLike & { target_date: string | null }> = {}): GoalLike & { target_date: string | null } => ({
  id: "g1",
  metric: "body_fat_pct",
  target: 18,
  target_date: null,
  start_value: 22,
  start_day: "2026-09-01",
  achieved_on: null,
  archived_at: null,
  ...over,
});

describe("goalReached: direção da meta", () => {
  it("descer: atinge no alvo ou abaixo", () => {
    expect(goalReached(22, 18, 18)).toBe(true);
    expect(goalReached(22, 17.5, 18)).toBe(true);
    expect(goalReached(22, 18.1, 18)).toBe(false);
  });
  it("subir: atinge no alvo ou acima", () => {
    expect(goalReached(35, 40, 40)).toBe(true);
    expect(goalReached(35, 39.9, 40)).toBe(false);
  });
});

describe("goalView: progresso e projeção", () => {
  // 3 medições em queda de 0,1 p.p./dia: a reta 22 − 0,1·x chega a 18 em x = 40 (11/10).
  const falling = [m("2026-09-01", { body_fat_pct: 22 }), m("2026-09-11", { body_fat_pct: 21 }), m("2026-09-21", { body_fat_pct: 20 })];

  it("descendo: 50% concluído, partida → atual → alvo e data da projeção", () => {
    const v = goalView(goal(), falling);
    expect(v.start).toEqual({ day: "2026-09-01", value: 22 });
    expect(v.current).toEqual({ day: "2026-09-21", value: 20 });
    expect(v.progressText).toBe("50% concluído");
    expect(v.projection).toEqual({ date: "2026-10-11" });
    expect(v.projectionText).toBe("Deve chegar em 11/10/2026");
    expect(v.late).toBe(false);
    expect(goalView(goal({ target_date: "2026-10-01" }), falling).late).toBe(true);
  });

  it("subindo (músculo): progresso proporcional", () => {
    const up = [m("2026-09-01", { skeletal_muscle_kg: 35 }), m("2026-09-11", { skeletal_muscle_kg: 36 }), m("2026-09-21", { skeletal_muscle_kg: 37 })];
    const v = goalView(goal({ metric: "skeletal_muscle_kg", start_value: 35, target: 39 }), up);
    expect(v.progressText).toBe("50% concluído");
    expect(v.projectionText).toBe("Deve chegar em 11/10/2026");
  });

  it("já atingida: 100% e sem projeção com o motivo", () => {
    const v = goalView(goal({ target: 20.5 }), falling);
    expect(v.progressText).toBe("100% concluído");
    expect(v.projectionText).toBe("Sem projeção: a meta já foi atingida");
  });

  it("motivos de sem projeção: poucas medições, tendência contrária e estável", () => {
    expect(goalView(goal(), falling.slice(0, 2)).projectionText).toBe("Sem projeção: poucas medições (são precisas 3)");
    const rising = [m("2026-09-01", { body_fat_pct: 22 }), m("2026-09-11", { body_fat_pct: 22.5 }), m("2026-09-21", { body_fat_pct: 23 })];
    const away = goalView(goal(), rising);
    expect(away.projectionText).toBe("Sem projeção: a tendência vai na direção contrária ao alvo");
    expect(away.progressText).toBe("0% concluído");
    const flat = [m("2026-09-01", { body_fat_pct: 21 }), m("2026-09-11", { body_fat_pct: 21 }), m("2026-09-21", { body_fat_pct: 21 })];
    expect(goalView(goal(), flat).projectionText).toBe("Sem projeção: a tendência está estável");
    expect(projectionText({ none: "flat" })).toBe("Sem projeção: a tendência está estável");
  });

  it("sem medição da métrica, o atual é a partida", () => {
    expect(goalView(goal(), [m("2026-09-01", { weight_kg: 80 })]).current).toEqual({ day: "2026-09-01", value: 22 });
  });
});

describe("newlyAchieved: conclusão ao salvar a medição", () => {
  it("marca a meta ativa cujo alvo a medição atingiu, com o dia da medição", () => {
    expect(newlyAchieved([goal()], m("2026-10-05", { body_fat_pct: 17.9 }))).toEqual([{ id: "g1", achieved_on: "2026-10-05" }]);
    expect(newlyAchieved([goal()], m("2026-10-05", { body_fat_pct: 18.2 }))).toEqual([]);
  });

  it("idempotente: já marcada, arquivada, antes da partida ou sem a métrica não marca", () => {
    const hit = m("2026-10-05", { body_fat_pct: 17 });
    expect(newlyAchieved([goal({ achieved_on: "2026-10-01" })], hit)).toEqual([]);
    expect(newlyAchieved([goal({ archived_at: "2026-10-02T00:00:00Z" })], hit)).toEqual([]);
    expect(newlyAchieved([goal()], m("2026-08-30", { body_fat_pct: 17 }))).toEqual([]);
    expect(newlyAchieved([goal()], m("2026-10-05", { weight_kg: 80 }))).toEqual([]);
  });
});

describe("goalFormErrors", () => {
  it("valida métrica, alvo, faixa, partida e data-alvo", () => {
    expect(goalFormErrors("", 18, 22, "", "2026-10-20")).toEqual(["Escolha a métrica."]);
    expect(goalFormErrors("body_fat_pct", null, 22, "", "2026-10-20")).toEqual(["Informe o alvo."]);
    expect(goalFormErrors("body_fat_pct", 1, 22, "", "2026-10-20")).toEqual(["Alvo entre 2 e 70 %."]);
    expect(goalFormErrors("body_fat_pct", 22, 22, "", "2026-10-20")).toEqual(["O alvo precisa ser diferente do valor de partida."]);
    expect(goalFormErrors("body_fat_pct", 18, 22, "2026-10-19", "2026-10-20")).toEqual(["A data-alvo não pode estar no passado."]);
    expect(goalFormErrors("visceral_fat", 7, null, "", "2026-10-20")).toEqual(["Ainda não há medição de gordura visceral."]);
    expect(goalFormErrors("body_fat_pct", 18, 22, "2026-12-31", "2026-10-20")).toEqual([]);
  });
});

describe("bmrInputFrom: TMB e massa magra das medições", () => {
  const ms = [
    m("2026-09-01", { bmr_kcal: 1800, lean_mass_kg: 64 }),
    m("2026-10-01", { lean_mass_kg: 65 }),
    m("2026-10-25", { bmr_kcal: 1900, lean_mass_kg: 66 }),
  ];
  it("última TMB e última massa magra até o dia, cada uma da sua medição", () => {
    expect(bmrInputFrom(ms, "2026-10-20")).toEqual({ measuredKcal: 1800, measuredOn: "2026-09-01", leanMassKg: 65 });
    expect(bmrInputFrom(ms, "2026-10-25")).toEqual({ measuredKcal: 1900, measuredOn: "2026-10-25", leanMassKg: 66 });
    expect(latestValue(ms, "bmr_kcal")).toEqual({ day: "2026-10-25", value: 1900 });
  });
  it("sem medição, nada (as metas seguem a v2)", () => {
    expect(bmrInputFrom([], "2026-10-20")).toBeUndefined();
    expect(bmrInputFrom([m("2026-10-01", { weight_kg: 80 })], "2026-10-20")).toBeUndefined();
  });
});

describe("fonte da TMB no formulário", () => {
  const scale = { measuredKcal: 1900, measuredOn: "2026-10-05", leanMassKg: 65 };

  it("bmrChoice e o texto: balança, fórmula escolhida, sem medição, antiga e reserva", () => {
    expect(bmrSourceText(bmrChoice("auto", "2026-10-20", scale))).toEqual({
      title: "TMB: balança (05/10)",
      detail: "Metabolismo basal medido pela balança em 05/10/2026.",
    });
    expect(bmrSourceText(bmrChoice("formula", "2026-10-20", scale)).title).toBe("TMB: fórmula");
    expect(bmrChoice("formula", "2026-10-20", scale).reason).toBe("formula_chosen");
    expect(bmrSourceText(bmrChoice("auto", "2026-10-20", undefined)).detail).toMatch(/^Sem medição da balança/);
    const stale = bmrChoice("auto", "2026-11-20", scale);
    expect(stale).toEqual({ source: "formula", reason: "stale", date: "2026-10-05" });
    expect(bmrSourceText(stale).detail).toBe("A última TMB medida (05/10/2026) tem mais de 30 dias: usa a fórmula de Mifflin-St Jeor.");
    expect(bmrChoice("scale", "2026-11-20", scale)).toEqual({ source: "scale", reason: "scale", date: "2026-10-05" });
    expect(bmrSourceText(bmrChoice("scale", "2026-10-20", { leanMassKg: 65 })).detail).toMatch(/^Você escolheu a balança, mas/);
  });

  it("BmrSourceLine mostra a fonte certa", () => {
    const { rerender } = render(createElement(BmrSourceLine, { choice: bmrChoice("auto", "2026-10-20", scale) }));
    expect(screen.getByTestId("bmr-source")).toHaveTextContent("TMB: balança (05/10)");
    expect(screen.getByTestId("bmr-source")).toHaveAttribute("data-source", "scale");
    rerender(createElement(BmrSourceLine, { choice: bmrChoice("formula", "2026-10-20", scale) }));
    expect(screen.getByTestId("bmr-source")).toHaveTextContent("TMB: fórmula");
  });

  /*
   * Perfil fictício: homem, 30 anos, 180 cm, 80 kg, moderado, manter, 2 g/kg.
   *   Fórmula: TMB 1780 → 2759 kcal · P 160 · C 386 · G 64.
   *   Balança: TMB 1900 → 1900 × 1,55 = 2945 kcal; P 160; G máx(64; 65,4) = 65; C (2945 − 640 − 589) ÷ 4 = 429.
   *   Massa magra 65 kg × 2,5 = 162,5 g.
   */
  const male: CompleteProfile = {
    sex: "m",
    birth_date: "1996-05-10",
    height_cm: 180,
    activity_level: "moderate",
    goal: "maintain",
    protein_g_per_kg: 2,
    goal_overrides: {},
  };

  it("a conta passo a passo usa a fonte escolhida", () => {
    const { rerender } = render(createElement(BreakdownSteps, { profile: male, weightKg: 80, today: "2026-10-20", bmrInput: scale }));
    const steps = () => within(screen.getByTestId("goal-breakdown"));
    expect(steps().getByText("TMB (balança, 05/10)")).toBeInTheDocument();
    expect(steps().getByText("1.900 kcal medidos pela balança")).toBeInTheDocument();
    expect(steps().getByText("1.900 × 1,55 = 2.945 kcal")).toBeInTheDocument();

    rerender(createElement(BreakdownSteps, { profile: { ...male, bmr_source: "formula" }, weightKg: 80, today: "2026-10-20", bmrInput: scale }));
    expect(steps().getByText("10 × 80 + 6,25 × 180 − 5 × 30 + 5 = 1.780 kcal")).toBeInTheDocument();

    rerender(
      createElement(BreakdownSteps, { profile: { ...male, protein_basis: "lean_mass" }, weightKg: 80, today: "2026-10-20", bmrInput: scale }),
    );
    expect(steps().getByText("2,5 g/kg × 65 kg = 163 g")).toBeInTheDocument();
  });

  it("metas do dia: balança × fórmula × sem medição", () => {
    expect(goalsFromProfile(male, 80, false, "2026-10-20", scale)).toEqual({ kcal: 2945, protein: 160, carbs: 429, fat: 65 });
    expect(goalsFromProfile({ ...male, bmr_source: "formula" }, 80, false, "2026-10-20", scale)).toEqual({
      kcal: 2759,
      protein: 160,
      carbs: 386,
      fat: 64,
    });
    expect(goalsFromProfile(male, 80, false, "2026-10-20", bmrInputFrom([], "2026-10-20"))).toEqual({
      kcal: 2759,
      protein: 160,
      carbs: 386,
      fat: 64,
    });
  });
});
