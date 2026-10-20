import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { NutritionBars } from "@/features/nutrition/components/nutrition-bars";

const goal = { kcal: 2759, protein: 160, carbs: 386, fat: 64 };

describe("NutritionBars", () => {
  it("mostra consumido / meta e quanto falta, em texto", () => {
    render(<NutritionBars consumed={{ kcal: 1234.4, protein: 80.04, carbs: 386, fat: 0 }} goal={goal} />);
    const kcal = screen.getByTestId("nutrition-kcal");
    expect(kcal).toHaveTextContent("Calorias");
    expect(kcal).toHaveTextContent("1.234 / 2.759 kcal");
    expect(within(kcal).getByTestId("nutrition-status")).toHaveTextContent("Faltam 1.525 kcal");
    expect(kcal).toHaveAttribute("data-state", "under");
    expect(within(screen.getByTestId("nutrition-protein")).getByTestId("nutrition-status")).toHaveTextContent("Faltam 80 g");
    const carbs = screen.getByTestId("nutrition-carbs");
    expect(carbs).toHaveAttribute("data-state", "met");
    expect(within(carbs).getByTestId("nutrition-status")).toHaveTextContent("Meta atingida");
  });

  it("excedente vem com texto e ícone, e a barra não passa de 100%", () => {
    const { container } = render(<NutritionBars consumed={{ kcal: 3000, protein: 170.5, carbs: 0, fat: 0 }} goal={goal} />);
    const kcal = screen.getByTestId("nutrition-kcal");
    expect(kcal).toHaveAttribute("data-state", "over");
    const status = within(kcal).getByTestId("nutrition-status");
    expect(status).toHaveTextContent("Acima da meta: +241 kcal");
    expect(status.querySelector("svg")).not.toBeNull();
    expect(within(screen.getByTestId("nutrition-protein")).getByTestId("nutrition-status")).toHaveTextContent(
      "Acima da meta: +10,5 g",
    );
    const fill = kcal.querySelector<HTMLElement>("[aria-hidden] > div");
    expect(fill?.style.width).toBe("100%");
    expect(container.querySelectorAll("li")).toHaveLength(4);
  });
});
