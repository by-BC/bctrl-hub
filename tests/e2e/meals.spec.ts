import { expect, test, type Page } from "@playwright/test";
import { dayInSaoPaulo } from "../../src/lib/domain/day";
import {
  createDisposableUser,
  deleteDisposableUser,
  seedExercise,
  seedMealPlan,
  seedWorkout,
  type DisposableUser,
} from "./disposable-user";
import { loginAndWaitForHome } from "./fixtures";

const today = dayInSaoPaulo(new Date());

const mealCard = (page: Page, name: string) => page.getByTestId("meal-card").filter({ hasText: name });
const dayAdherence = (page: Page) => page.getByTestId("day-adherence");
const sheet = (page: Page) => page.getByRole("dialog");

// Um usuário novo por teste: cada um parte do mesmo plano, em qualquer ordem e repetido.
test.describe("refeições do dia e plano alimentar", () => {
  let user: DisposableUser;

  test.beforeEach(async ({ page }) => {
    user = await createDisposableUser("e2e-refeicoes");
    await seedMealPlan(user);
    await loginAndWaitForHome(page, user.email, user.password);
  });
  test.afterEach(async () => {
    await deleteDisposableUser(user);
  });

  test("marcar o café com a Opção 2 sobe a adesão; trocar de opção não duplica", async ({ page }) => {
    await page.goto("/comida");
    const cards = page.getByTestId("meal-card");
    // Sem treino: o pós-treino não aparece; ordem por horário.
    await expect(cards).toHaveCount(3);
    await expect(cards.nth(0)).toContainText("Café da manhã");
    await expect(cards.nth(1)).toContainText("Almoço");
    await expect(cards.nth(2)).toContainText("Jantar");
    await expect(page.getByText("Pós-treino aparece quando houver treino")).toBeVisible();
    await expect(dayAdherence(page)).toContainText("0%");
    await expect(dayAdherence(page)).toContainText("0 de 3 no plano");
    await expect(page.getByTestId("week-adherence")).toBeVisible();

    // Toque 1: refeição. Substituições começam recolhidas.
    await mealCard(page, "Café da manhã").click();
    const options = sheet(page);
    await expect(options.getByRole("heading", { name: "Café da manhã" })).toBeVisible();
    await expect(options.getByText("ou Aveia 30 g")).toBeHidden();
    await options.getByRole("button", { name: /Ver substituição de Granola/ }).click();
    await expect(options.getByText("ou Aveia 30 g")).toBeVisible();

    // Toque 2: a opção. Marca e fecha.
    await options.getByRole("button", { name: "Comi a Opção 2: Iogurte" }).click();
    await expect(sheet(page)).toBeHidden();
    await expect(mealCard(page, "Café da manhã")).toContainText("Feita");
    await expect(mealCard(page, "Café da manhã")).toContainText("Opção 2: Iogurte");
    await expect(dayAdherence(page)).toContainText("33%");
    await expect(dayAdherence(page)).toContainText("1 de 3 no plano");
    await expect(page.getByTestId("week-adherence")).toContainText(/[1-9]\d* de \d+ no plano/);

    // Troca para a Opção 1: continua 1 registro.
    await mealCard(page, "Café da manhã").click();
    await expect(sheet(page).getByRole("button", { name: "Opção 2 escolhida" })).toBeVisible();
    await sheet(page).getByRole("button", { name: "Comi a Opção 1: Tapioca" }).click();
    await expect(mealCard(page, "Café da manhã")).toContainText("Opção 1: Tapioca");
    await expect(dayAdherence(page)).toContainText("1 de 3 no plano");

    // Gravado no banco: sobrevive ao reload.
    await page.reload();
    await expect(mealCard(page, "Café da manhã")).toContainText("Opção 1: Tapioca");
    await expect(dayAdherence(page)).toContainText("1 de 3 no plano");

    // Desmarcar volta a pendente.
    await mealCard(page, "Café da manhã").click();
    await sheet(page).getByRole("button", { name: "Desmarcar refeição" }).click();
    await expect(mealCard(page, "Café da manhã")).toContainText("Pendente");
    await expect(dayAdherence(page)).toContainText("0 de 3 no plano");
  });

  test("jantar fora do plano com nota: registrado, mas sem contar como aderente", async ({ page }) => {
    await page.goto("/comida");
    await mealCard(page, "Jantar").click();
    const form = sheet(page).getByRole("form", { name: "Fora do plano" });
    await form.getByLabel("Comeu outra coisa? Anote (opcional)").fill("Pizza com os amigos");
    await form.getByRole("button", { name: "Marcar fora do plano" }).click();

    await expect(sheet(page)).toBeHidden();
    await expect(mealCard(page, "Jantar")).toContainText("Fora do plano");
    await expect(mealCard(page, "Jantar")).toContainText("Pizza com os amigos");
    await expect(dayAdherence(page)).toContainText("0 de 3 no plano");
    await expect(dayAdherence(page)).toContainText("1 fora do plano");

    await page.reload();
    await expect(mealCard(page, "Jantar")).toContainText("Pizza com os amigos");
    // Ontem não tem registro: o seletor de data troca o dia.
    await page.getByRole("button", { name: "Ontem" }).click();
    await expect(mealCard(page, "Jantar")).toContainText("Pendente");
  });

  test("com treino gravado no dia, o pós-treino aparece e conta na adesão", async ({ page }) => {
    const exercise = await seedExercise(user, "Supino E2E");
    await seedWorkout(user, { day: today, sets: [[exercise, [[40, 10]]]] });

    await page.goto("/comida");
    const cards = page.getByTestId("meal-card");
    await expect(cards).toHaveCount(4);
    // Sem horário: fica na sua posição, entre o almoço e o jantar.
    await expect(cards.nth(2)).toContainText("Pós-treino");
    await expect(dayAdherence(page)).toContainText("0 de 4 no plano");

    await mealCard(page, "Pós-treino").click();
    await sheet(page).getByRole("button", { name: "Comi a Opção 1: Vitamina" }).click();
    await expect(dayAdherence(page)).toContainText("1 de 4 no plano");
    await expect(dayAdherence(page)).toContainText("25%");

    // Amanhã ainda não tem treino.
    await page.getByRole("button", { name: "Amanhã" }).click();
    await expect(cards).toHaveCount(3);
  });

  test("editar uma opção no plano reflete na tela do dia", async ({ page }) => {
    await page.goto("/comida");
    await page.getByRole("link", { name: "Editar plano" }).click();
    await expect(page).toHaveURL(/\/comida\/plano$/);
    await expect(page.getByRole("heading", { level: 1, name: "Plano alimentar" })).toBeVisible();

    const cafe = page.getByRole("article", { name: "Café da manhã" });
    await cafe.getByRole("button", { name: /Opção 2\s*Iogurte/ }).click();
    const form = cafe.getByRole("form", { name: "Editar Opção 2" });
    await form.getByLabel("Título da opção").fill("Iogurte com fruta");
    await form.getByLabel("Item 1: quantidade").fill("200 g");
    await form.getByRole("button", { name: "Adicionar item" }).click();
    await form.getByLabel("Item 3: nome").fill("Morango");
    await form.getByLabel("Item 3: quantidade").fill("100 g");
    await form.getByLabel("Item 3: substituições, uma por linha").fill("Banana 1 un\nMamão 100 g");
    await form.getByRole("button", { name: "Salvar opção" }).click();
    await expect(page.getByTestId("save-status")).toHaveText("Salvo");
    await expect(form.getByRole("button", { name: "Salvar opção" })).toBeDisabled();

    // Horário novo reordena a tela do dia: almoço às 07:00 passa o café.
    const almoco = page.getByRole("article", { name: "Almoço" });
    await almoco.getByLabel("Horário").fill("07:00");
    await almoco.getByLabel("Horário").blur();
    await expect(page.getByTestId("save-status")).toHaveText("Salvo");

    await page.getByRole("link", { name: "Comida" }).first().click();
    await expect(page).toHaveURL(/\/comida$/);
    await expect(page.getByTestId("meal-card").nth(0)).toContainText("Almoço");
    await mealCard(page, "Café da manhã").click();
    const option = sheet(page).getByRole("article", { name: "Opção 2: Iogurte com fruta" });
    await expect(option).toContainText("200 g");
    await expect(option).toContainText("Morango");
    await option.getByRole("button", { name: /Ver 2 substituições de Morango/ }).click();
    await expect(option.getByText("ou Mamão 100 g")).toBeVisible();
  });

  test("sem rolagem horizontal em 375 px (dia, opções e editor)", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

    await page.goto("/comida");
    await expect(page.getByTestId("meal-card")).toHaveCount(3);
    expect(await overflow()).toBeLessThanOrEqual(0);
    await mealCard(page, "Café da manhã").click();
    await expect(sheet(page)).toBeVisible();
    expect(await overflow()).toBeLessThanOrEqual(0);

    await page.goto("/comida/plano");
    const cafe = page.getByRole("article", { name: "Café da manhã" });
    await cafe.getByRole("button", { name: /Opção 1\s*Tapioca/ }).click();
    await expect(cafe.getByRole("form", { name: "Editar Opção 1" })).toBeVisible();
    expect(await overflow()).toBeLessThanOrEqual(0);
  });

  test("excluir uma refeição pede confirmação", async ({ page }) => {
    await page.goto("/comida/plano");
    const jantar = page.getByRole("article", { name: "Jantar" });
    await jantar.getByRole("button", { name: "Excluir refeição" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText("Excluir Jantar?");
    await dialog.getByRole("button", { name: "Excluir refeição" }).click();
    await expect(page.getByRole("article", { name: "Jantar" })).toHaveCount(0);
    await expect(page.getByTestId("save-status")).toHaveText("Salvo");

    await page.goto("/comida");
    await expect(page.getByTestId("meal-card")).toHaveCount(2);
    await expect(dayAdherence(page)).toContainText("0 de 2 no plano");
  });
});
