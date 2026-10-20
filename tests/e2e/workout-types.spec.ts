import { expect, test, type Page } from "@playwright/test";
import { createDisposableUser, deleteDisposableUser, seedTypedPlan, type DisposableUser } from "./disposable-user";
import { loginAndWaitForHome } from "./fixtures";

/**
 * v2: sessão com prancha (duração), corrida (distância e duração) e supino com uma série de
 * aquecimento. O aquecimento não vira PR nem entra no volume, e o histórico mostra cada tipo.
 */

const exerciseCard = (page: Page, name: string) => page.getByRole("article", { name });

test.describe("tipos de série", () => {
  let user: DisposableUser;

  test.beforeAll(async () => {
    user = await createDisposableUser("e2e-tipos");
    await seedTypedPlan(user);
  });
  test.afterAll(async () => {
    await deleteDisposableUser(user);
  });

  test("prancha 60 s, corrida 2 km / 12 min e supino com aquecimento: resumo e histórico", async ({ page }) => {
    await loginAndWaitForHome(page, user.email, user.password);
    await page.goto("/treino");
    const card = page.getByTestId("next-workout-card");
    await expect(card).toContainText("Tipos E2E");
    await card.getByRole("button", { name: "Iniciar treino" }).click();
    await expect(page).toHaveURL(/\/treino\/sessao$/);

    // Prancha: só o campo de duração.
    const prancha = exerciseCard(page, "Prancha E2E");
    await expect(prancha.getByLabel(/^Carga da série/)).toHaveCount(0);
    await prancha.getByLabel("Duração da série 1 de Prancha E2E (minutos:segundos)").fill("1:00");
    await prancha.getByRole("button", { name: "Concluir série 1 de Prancha E2E" }).click();
    await expect(prancha.getByRole("button", { name: "Desfazer série 1 de Prancha E2E" })).toBeVisible();

    // Corrida: distância (km) e duração.
    const corrida = exerciseCard(page, "Corrida E2E");
    await corrida.getByLabel("Distância da série 1 de Corrida E2E (km)").fill("2");
    await corrida.getByLabel("Duração da série 1 de Corrida E2E (minutos:segundos)").fill("12:00");
    await corrida.getByRole("button", { name: "Concluir série 1 de Corrida E2E" }).click();
    await expect(corrida.getByRole("button", { name: "Desfazer série 1 de Corrida E2E" })).toBeVisible();

    // Supino: a 1ª série vira aquecimento (selo com texto) e o "anterior" passa para a 2ª.
    const supino = exerciseCard(page, "Supino Tipos E2E");
    await expect(supino.getByTestId("previous")).toHaveText(["Anterior: 40 × 10", "Anterior: —"]);
    await supino.getByRole("button", { name: "Marcar série 1 de Supino Tipos E2E como aquecimento" }).click();
    await expect(supino.getByTestId("warmup-badge")).toContainText("Aquecimento");
    await expect(supino.getByTestId("previous")).toHaveText(["Anterior: —", "Anterior: 40 × 10"]);

    // Aquecimento mais pesado que o recorde: não é PR.
    await supino.getByLabel("Carga da série 1 de Supino Tipos E2E (kg)").fill("60");
    await supino.getByLabel("Repetições da série 1 de Supino Tipos E2E").fill("10");
    await supino.getByRole("button", { name: "Concluir série 1 de Supino Tipos E2E" }).click();
    // Série de trabalho igual ao anterior (✓ sem digitar): empate, sem PR.
    await supino.getByRole("button", { name: "Concluir série 2 de Supino Tipos E2E" }).click();
    await expect(supino.getByLabel("Carga da série 2 de Supino Tipos E2E (kg)")).toHaveValue("40");
    await expect(supino.getByTestId("pr-badge")).toHaveCount(0);

    await page.getByRole("button", { name: "Finalizar", exact: true }).click();
    const sheet = page.getByRole("dialog", { name: "Finalizar treino?" });
    await sheet.getByRole("button", { name: "Salvar treino" }).click();
    await expect(sheet).toBeHidden();
    await expect(page.getByRole("heading", { level: 1, name: "Treino salvo" })).toBeVisible();

    // 3 séries de trabalho (aquecimento fora), volume só do supino de trabalho (40 × 10), sem PR.
    const summary = page.getByTestId("workout-summary");
    await expect(summary).toContainText("Séries3");
    await expect(summary).toContainText("400");
    await expect(summary).toContainText("PRs0");

    await page.getByRole("link", { name: "Ver no histórico" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Tipos E2E" })).toBeVisible();
    await expect(exerciseCard(page, "Prancha E2E").getByTestId("history-set")).toContainText("1:00");
    await expect(exerciseCard(page, "Corrida E2E").getByTestId("history-set")).toContainText("2 km · 12:00");
    const supinoSets = exerciseCard(page, "Supino Tipos E2E").getByTestId("history-set");
    await expect(supinoSets.nth(0)).toContainText("60 kg × 10");
    await expect(supinoSets.nth(0)).toContainText("Aquecimento");
    await expect(supinoSets.nth(1)).toContainText("40 kg × 10");
    await expect(supinoSets.nth(1)).not.toContainText("Aquecimento");
    await expect(page.getByTestId("pr-badge")).toHaveCount(0);

    // Editar a duração da prancha no histórico.
    await page.getByRole("button", { name: "Editar" }).click();
    const duration = page.getByLabel("Duração da série 1 de Prancha E2E (minutos:segundos)");
    await expect(duration).toHaveValue("1:00");
    await duration.fill("1:15");
    const saved = page.waitForResponse(
      (r) => r.url().includes("/rest/v1/workout_sets") && r.request().method() === "PATCH",
    );
    await duration.blur();
    expect((await saved).ok()).toBe(true);
    await page.reload();
    await expect(exerciseCard(page, "Prancha E2E").getByTestId("history-set")).toContainText("1:15");

    // Evolução da prancha: recorde e gráfico de duração.
    await page.goto("/evolucao");
    await page.getByRole("link", { name: /Prancha E2E/ }).click();
    await expect(page.getByTestId("exercise-bests")).toContainText("Maior duração");
    await expect(page.getByTestId("exercise-bests")).toContainText("1:15");
    await expect(page.getByTestId("exercise-session").first()).toContainText("1:15");
  });
});
