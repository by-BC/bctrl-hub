import { expect, test, type Page } from "@playwright/test";
import {
  countRows,
  createDisposableUser,
  deleteDisposableUser,
  seedMealPlan,
  seedNutrition,
  type DisposableUser,
} from "./disposable-user";
import { loginAndWaitForHome } from "./fixtures";

/**
 * Task 5.0 v2: perfil → metas calculadas (conta passo a passo e ajuste manual), consumido × meta
 * em /comida e no painel Hoje, alimento fora do plano (TACO, com snapshot) e o mesmo registro
 * Dados fictícios em usuário descartável.
 *
 * Perfil de exemplo (m, 30 anos, 180 cm, 80 kg, moderado, manter, 2 g/kg): 2.759 kcal ·
 * P 160 g · C 386 g · G 64 g (conta em tests/unit/goals.test.ts).
 */

const SYNC = { timeout: 15_000 };

const mealCard = (page: Page, name: string) => page.getByTestId("meal-card").filter({ hasText: name });
const mealSheet = (page: Page) => page.getByRole("dialog");
const kcalRow = (page: Page) => page.getByTestId("day-nutrition").getByTestId("nutrition-kcal");
/** Nascimento que dá 30 anos hoje (1º de janeiro, 30 anos atrás). */
const birth30 = () => `${new Date().getFullYear() - 30}-01-01`;

async function addOffPlan(page: Page, meal: string, search: string, grams: string) {
  await mealCard(page, meal).click();
  await page.getByRole("button", { name: "Adicionar alimento" }).click();
  const add = page.getByRole("dialog", { name: "Adicionar alimento" });
  await add.getByLabel("Buscar alimento").fill(search);
  await add.getByRole("button", { name: /^Arroz, integral, cozido/ }).click();
  await add.getByRole("textbox", { name: "Quantidade", exact: true }).fill(grams);
  await add.getByRole("button", { name: "Adicionar", exact: true }).click();
  // O diálogo de adicionar terminou de fechar (a animação de saída ainda prende o Escape).
  await expect(page.locator('[data-slot="dialog-content"]')).toHaveCount(0);
}

test.describe("metas nutricionais e fora do plano", () => {
  let user: DisposableUser;

  test.afterEach(async () => {
    await deleteDisposableUser(user);
  });

  test("salva o perfil, vê as metas e as barras avançam com a opção e o fora do plano", async ({ page }) => {
    test.setTimeout(90_000);
    user = await createDisposableUser("e2e-metas");
    const meals = await seedMealPlan(user);
    await seedNutrition(user, meals, { weightKg: 80 });
    await loginAndWaitForHome(page, user.email, user.password);

    // Sem perfil: Comida pede os dados.
    await page.goto("/comida");
    await expect(page.getByTestId("nutrition-missing")).toContainText("preencha seus dados");

    // Perfil: conta passo a passo e metas ao vivo.
    await page.goto("/perfil/dados");
    await page.getByRole("group", { name: "Sexo" }).getByRole("button", { name: "Masculino" }).click();
    await page.getByLabel("Nascimento").fill(birth30());
    await page.getByLabel("Altura (cm)").fill("180");
    await page.getByLabel("Nível de atividade").selectOption("moderate");
    await page.getByRole("group", { name: "Objetivo" }).getByRole("button", { name: "Manter" }).click();
    await expect(page.getByLabel("Proteína (g por kg de peso)")).toHaveValue("2");
    await expect(page.getByTestId("profile-weight")).toContainText("80 kg");

    const breakdown = page.getByTestId("goal-breakdown");
    await expect(breakdown).toContainText("10 × 80 + 6,25 × 180 − 5 × 30 + 5 = 1.780 kcal");
    await expect(breakdown).toContainText("1.780 × 1,55 = 2.759 kcal");
    await expect(page.getByTestId("goals-rest")).toHaveText("Meta: 2.759 kcal · P 160 g · C 386 g · G 64 g");
    await expect(page.getByTestId("goals-training")).toHaveText("Meta: 2.913 kcal · P 160 g · C 424 g · G 64 g");

    // Ajuste manual de um macro: só ele muda.
    await page.getByLabel("Proteína (g) (dia sem treino)").fill("180");
    await expect(page.getByTestId("goals-rest")).toHaveText("Meta: 2.759 kcal · P 180 g · C 386 g · G 64 g");
    await page.getByLabel("Proteína (g) (dia sem treino)").fill("");

    await page.getByRole("button", { name: "Salvar dados" }).click();
    await expect(page.getByText("Dados salvos.")).toBeVisible();
    await expect.poll(() => countRows(user, "profiles"), SYNC).toBe(1);
    await page.reload();
    await expect(page.getByLabel("Altura (cm)")).toHaveValue("180");
    await expect(page.getByTestId("goals-rest")).toHaveText("Meta: 2.759 kcal · P 160 g · C 386 g · G 64 g");

    // Comida: consumido × meta.
    await page.goto("/comida");
    await expect(kcalRow(page)).toContainText("0 / 2.759 kcal");
    await expect(kcalRow(page).getByTestId("nutrition-status")).toHaveText("Faltam 2.759 kcal");

    // Marcar o almoço (arroz 150 g vinculado; frango sem valor).
    await mealCard(page, "Almoço").click();
    await mealSheet(page).getByRole("button", { name: "Comi a Opção 1: Prato feito" }).click();
    await expect(mealSheet(page)).toBeHidden();
    await expect(kcalRow(page)).toContainText("185 / 2.759 kcal");
    await expect(page.getByTestId("nutrition-unresolved")).toContainText("1 item sem valor");

    // Jantar fora do plano: arroz integral 150 g ≈ 185 kcal (185,3 + 185,295 da opção = 371).
    await addOffPlan(page, "Jantar", "arroz integral cozido", "150");
    const item = page.getByTestId("off-plan-item");
    await expect(item).toContainText("Arroz, integral, cozido");
    await expect(item).toContainText("150 g · 185 kcal");
    await page.keyboard.press("Escape");
    await expect(mealSheet(page)).toBeHidden();
    await expect(mealCard(page, "Jantar")).toContainText("Fora do plano");
    await expect(kcalRow(page)).toContainText("371 / 2.759 kcal");
    await expect.poll(() => countRows(user, "meal_log_items"), SYNC).toBe(1);

    // Painel Hoje mostra o mesmo.
    await page.goto("/");
    await expect(page.getByTestId("today-refeicoes").getByTestId("nutrition-kcal")).toContainText("371 / 2.759 kcal");

    // Remover o item volta o total.
    await page.goto("/comida");
    await mealCard(page, "Jantar").click();
    await page.getByRole("button", { name: "Remover Arroz, integral, cozido" }).click();
    await expect(page.getByTestId("off-plan-item")).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(mealSheet(page)).toBeHidden();
    await expect(kcalRow(page)).toContainText("185 / 2.759 kcal");
    await expect.poll(() => countRows(user, "meal_log_items"), SYNC).toBe(0);
  });
});
