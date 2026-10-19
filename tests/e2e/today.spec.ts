import { expect, test, type Page } from "@playwright/test";
import {
  createDisposableUser,
  deleteDisposableUser,
  seedMealPlan,
  seedSystemHabits,
  seedTrainingPlan,
  type DisposableUser,
} from "./disposable-user";
import { loginAndWaitForHome } from "./fixtures";

const segment = (page: Page, key: "workouts" | "meals" | "habits") =>
  page.getByTestId("hex-progress").locator(`[data-segment="${key}"]`);
const progressOf = async (page: Page, key: "workouts" | "meals" | "habits") =>
  Number(await segment(page, key).getAttribute("data-progress"));

test.describe("painel Hoje", () => {
  let user: DisposableUser;

  // Usuário novo por teste: parte do mesmo plano em qualquer ordem e repetido.
  test.beforeEach(async ({ page }) => {
    user = await createDisposableUser("e2e-hoje");
    await Promise.all([seedTrainingPlan(user), seedMealPlan(user), seedSystemHabits(user)]);
    await loginAndWaitForHome(page, user.email, user.password);
  });
  test.afterEach(async () => {
    await deleteDisposableUser(user);
  });

  test("treino sugerido, ações rápidas enchem o Hex e Iniciar abre a rotina certa", async ({ page }) => {
    // Último treino foi o Lower: o sugerido volta para o Upper.
    const next = page.getByTestId("next-workout-card");
    await expect(next).toContainText("Treino de hoje");
    await expect(next.getByRole("heading")).toHaveText("Upper E2E");

    // Hex com os 3 segmentos rotulados; hábitos começam vazios.
    await expect(page.getByRole("img", { name: /^Treinos: \d\/4/ })).toBeVisible();
    await expect(page.getByRole("img", { name: /^Alimentação: / })).toBeVisible();
    await expect(segment(page, "habits")).toHaveAttribute("data-progress", "0.00");
    await expect(page.getByTestId("hex-legend")).toContainText("Cardio 0/150 min · Abdominal 0/3 · Suplementos 0/7");

    // Suplementos (1/7) → média dos 3 hábitos = 0,05, sem recarregar a página.
    const habits = page.getByTestId("today-habitos");
    await habits.getByRole("button", { name: "Marcar Desjejum/Suplementos hoje" }).click();
    await expect(habits.getByRole("button", { name: "Desfazer Desjejum/Suplementos de hoje" })).toBeVisible();
    await expect(segment(page, "habits")).toHaveAttribute("data-progress", "0.05");
    await expect(page.getByTestId("hex-legend")).toContainText("Suplementos 1/7");

    // Refeição marcada pelo mesmo sheet de /comida → o laranja sobe.
    const mealsBefore = await progressOf(page, "meals");
    const meals = page.getByTestId("today-refeicoes");
    await meals.getByTestId("meal-card").filter({ hasText: "Café da manhã" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Comi a Opção 1: Tapioca" }).click();
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(meals.getByTestId("meal-card").filter({ hasText: "Café da manhã" })).toContainText("Feita");
    await expect.poll(() => progressOf(page, "meals")).toBeGreaterThan(mealsBefore);

    // Iniciar leva à sessão do Upper.
    await next.getByRole("button", { name: "Iniciar treino" }).click();
    await expect(page).toHaveURL(/\/treino\/sessao$/);
    await expect(page.getByRole("heading", { level: 1, name: "Upper E2E" })).toBeVisible();

    // De volta ao Hoje: "Continuar treino".
    await page.goto("/");
    await expect(page.getByTestId("active-workout-card")).toContainText("Upper E2E");
    await expect(page.getByTestId("active-workout-card").getByRole("link", { name: "Continuar treino" })).toBeVisible();
  });
});

test("Hoje sem rolagem horizontal em 375 px", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await loginAndWaitForHome(page);
  await expect(page.getByTestId("hex-progress")).toBeVisible();
  await expect(page.getByTestId("today-tarefas").getByRole("heading")).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
