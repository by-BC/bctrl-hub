import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Measurement } from "@/features/composition/api";
import { MeasurementSheet } from "@/features/composition/components/measurement-sheet";
import { deltaView, fatMusclePoints, metricPoints, metricText, parseMetricInput } from "@/features/composition/view";
import { METRIC } from "@/features/composition/domain/composition";
import { saoPauloLocal, saoPauloLocalToInstant } from "@/lib/domain/day";
import { dayToTime } from "@/lib/domain/stats";

/** Medição fictícia com todas as métricas nulas, menos as passadas. */
function measurement(id: string, measured_at: string, day: string, values: Partial<Measurement> = {}): Measurement {
  const empty = Object.fromEntries(Object.keys(METRIC).map((k) => [k, null]));
  return { ...empty, id, measured_at, day, source: "manual", note: null, weight_kg: 80, ...values } as Measurement;
}

describe("variações (deltaView)", () => {
  it("gordura caindo é melhora; subindo é piora", () => {
    expect(deltaView(-1.25, "body_fat_pct", "desde a 1ª")).toEqual({
      direction: "down",
      tone: "good",
      value: "−1,25",
      unit: "p.p.",
      text: "−1,25 p.p. desde a 1ª",
    });
    expect(deltaView(0.4, "body_fat_pct", "vs anterior")).toMatchObject({ direction: "up", tone: "bad", text: "+0,4 p.p. vs anterior" });
  });

  it("músculo caindo é piora; subindo é melhora", () => {
    expect(deltaView(-0.3, "skeletal_muscle_kg", "vs anterior")).toMatchObject({ direction: "down", tone: "bad", text: "−0,3 kg vs anterior" });
    expect(deltaView(1.2, "lean_mass_kg", "desde a 1ª")).toMatchObject({ direction: "up", tone: "good", text: "+1,2 kg desde a 1ª" });
  });

  it("peso é neutro e visceral (sem unidade) cai como melhora", () => {
    expect(deltaView(-2, "weight_kg", "desde a 1ª")).toMatchObject({ direction: "down", tone: "neutral", text: "−2 kg desde a 1ª" });
    expect(deltaView(-1, "visceral_fat", "vs anterior")).toMatchObject({ tone: "good", text: "−1 vs anterior" });
  });

  it("sem base (uma medição só) e variação que arredonda para zero", () => {
    expect(deltaView(null, "body_fat_pct", "vs anterior")).toEqual({ direction: "none", tone: "neutral", value: null, unit: "", text: "sem base vs anterior" });
    expect(deltaView(0.001, "weight_kg", "vs anterior")).toMatchObject({ direction: "same", tone: "neutral", text: "igual vs anterior" });
  });

  it("valores com unidade: % colado, kcal sem casas, índice sem unidade", () => {
    expect(metricText(18.5, METRIC.body_fat_pct)).toBe("18,5%");
    expect(metricText(1789.4, METRIC.bmr_kcal)).toBe("1.789 kcal");
    expect(metricText(9, METRIC.visceral_fat)).toBe("9");
    expect(metricText(82.45, METRIC.weight_kg)).toBe("82,45 kg");
  });
});

describe("séries dos gráficos", () => {
  const ms = [
    measurement("b", "2026-06-10T10:00:00Z", "2026-06-10", { body_fat_pct: 21, fat_mass_kg: 17, skeletal_muscle_kg: 36 }),
    measurement("a", "2026-06-01T10:00:00Z", "2026-06-01", { body_fat_pct: 22, fat_mass_kg: 18 }),
    measurement("c", "2026-06-20T10:00:00Z", "2026-06-20", { fat_mass_kg: 16.5, skeletal_muscle_kg: 36.4 }),
  ];

  it("métrica: ordem cronológica, pula medição sem a métrica, `t` do dia", () => {
    expect(metricPoints(ms, "body_fat_pct")).toEqual([
      { id: "a", day: "2026-06-01", t: dayToTime("2026-06-01"), value: 22 },
      { id: "b", day: "2026-06-10", t: dayToTime("2026-06-10"), value: 21 },
    ]);
  });

  it("gordura × músculo: só as medições com as duas", () => {
    expect(fatMusclePoints(ms)).toEqual([
      { id: "b", day: "2026-06-10", t: dayToTime("2026-06-10"), fat: 17, muscle: 36 },
      { id: "c", day: "2026-06-20", t: dayToTime("2026-06-20"), fat: 16.5, muscle: 36.4 },
    ]);
  });
});

describe("campos do formulário", () => {
  it("aceita vírgula, ponto e negativo; vazio é nulo; texto é inválido", () => {
    expect(parseMetricInput("82,4")).toBe(82.4);
    expect(parseMetricInput(" 18.5 ")).toBe(18.5);
    expect(parseMetricInput("-3,2")).toBe(-3.2);
    expect(parseMetricInput("")).toBeNull();
    expect(parseMetricInput("abc")).toBeNaN();
  });

  it("data e hora de São Paulo ↔ instante (inclusive no antigo horário de verão)", () => {
    expect(saoPauloLocalToInstant("2026-10-20T07:05")).toBe("2026-10-20T10:05:00.000Z");
    expect(saoPauloLocal("2026-10-20T10:05:00.000Z")).toBe("2026-10-20T07:05");
    expect(saoPauloLocalToInstant("2018-12-01T07:00")).toBe("2018-12-01T09:00:00.000Z"); // −02:00
    expect(saoPauloLocalToInstant("20/10/2026")).toBeNull();
  });
});

describe("MeasurementSheet", () => {
  function setup() {
    const client = new QueryClient();
    const mutate = vi.spyOn(client.getMutationCache(), "build");
    render(
      <QueryClientProvider client={client}>
        <MeasurementSheet open measurement={null} onOpenChange={() => {}} />
      </QueryClientProvider>,
    );
    return { mutate };
  }

  it("mostra só as principais; Mais métricas expande as outras 12", () => {
    setup();
    const form = screen.getByRole("form", { name: "Nova medição" });
    expect(within(form).getByLabelText(/^Peso \(kg\)/)).toHaveAttribute("inputmode", "decimal");
    expect(within(form).getByLabelText("Gordura corporal (%)")).toBeVisible();
    expect(within(form).queryByLabelText("Metabolismo basal (kcal)")).toBeNull();
    fireEvent.click(within(form).getByRole("button", { name: /Mais métricas/ }));
    expect(within(form).getByLabelText("Metabolismo basal (kcal)")).toBeVisible();
    expect(within(form).getByLabelText("Idade metabólica (anos)")).toHaveAttribute("inputmode", "numeric");
  });

  it("valor fora da faixa mostra a mensagem, marca o campo e não grava", () => {
    const { mutate } = setup();
    const form = screen.getByRole("form", { name: "Nova medição" });
    fireEvent.change(within(form).getByLabelText(/^Peso \(kg\)/), { target: { value: "82,4" } });
    fireEvent.change(within(form).getByLabelText("Gordura corporal (%)"), { target: { value: "85" } });
    fireEvent.click(within(form).getByRole("button", { name: "Salvar medição" }));
    expect(within(form).getByRole("alert")).toHaveTextContent("Gordura corporal entre 2 e 70 %.");
    expect(within(form).getByLabelText("Gordura corporal (%)")).toHaveAttribute("aria-invalid", "true");
    expect(mutate).not.toHaveBeenCalled();
  });

  it("sem peso: pede o peso", () => {
    setup();
    const form = screen.getByRole("form", { name: "Nova medição" });
    fireEvent.click(within(form).getByRole("button", { name: "Salvar medição" }));
    expect(within(form).getByRole("alert")).toHaveTextContent("Informe o peso.");
  });
});
