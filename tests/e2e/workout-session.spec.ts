import { expect, test, type Page } from "@playwright/test";
import {
  createDisposableUser,
  deleteDisposableUser,
  seedTrainingPlan,
  type DisposableUser,
} from "./disposable-user";
import { loginAndWaitForHome } from "./fixtures";

const exerciseCard = (page: Page, name: string) => page.getByRole("article", { name });
const restTimer = (page: Page) => page.getByRole("region", { name: "Descanso" });

/** Inicia o treino sugerido em /treino e devolve o nome da rotina. */
async function startSuggested(page: Page) {
  await page.goto("/treino");
  const card = page.getByTestId("next-workout-card");
  const name = (await card.getByRole("heading").textContent())!.trim();
  await card.getByRole("button", { name: "Iniciar treino" }).click();
  await expect(page).toHaveURL(/\/treino\/sessao$/);
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  return name;
}

async function finishWorkout(page: Page) {
  await page.getByRole("button", { name: "Finalizar", exact: true }).click();
  const sheet = page.getByRole("dialog", { name: "Finalizar treino?" });
  await sheet.getByRole("button", { name: "Salvar treino" }).click();
  await expect(sheet).toBeHidden();
}

test.describe("sessão de treino", () => {
  let user: DisposableUser;

  test.beforeAll(async () => {
    user = await createDisposableUser("e2e-sessao");
    await seedTrainingPlan(user);
  });
  test.afterAll(async () => {
    await deleteDisposableUser(user);
  });
  test.beforeEach(async ({ page }) => {
    await loginAndWaitForHome(page, user.email, user.password);
  });

  test("treino completo: próxima rotina, anterior, timer, reload no meio, PR e histórico", async ({ page }) => {
    // Último treino foi o Lower: a sequência volta para o Upper.
    await page.goto("/treino");
    await expect(page.getByTestId("next-workout-card")).toContainText("Upper E2E");
    await startSuggested(page);

    const supino = exerciseCard(page, "Supino E2E");
    await expect(supino.getByTestId("previous")).toHaveText(["Anterior: 40 × 10", "Anterior: 40 × 8"]);
    await supino.getByText("Observações técnicas").click();
    await expect(supino.getByText("Escápulas encaixadas")).toBeVisible();

    // Série 1: 42,5 × 10 bate carga, volume e 1RM.
    await supino.getByLabel("Carga da série 1 de Supino E2E (kg)").fill("42,5");
    await supino.getByLabel("Repetições da série 1 de Supino E2E").fill("10");
    await supino.getByRole("button", { name: "Concluir série 1 de Supino E2E" }).click();
    await expect(supino.getByTestId("pr-badge")).toHaveText("PR · carga, volume, 1RM");
    await expect(restTimer(page)).toBeVisible();
    await expect(page.getByTestId("rest-remaining")).toHaveText(/^[01]:\d\d$/);

    // Recarregar no meio do treino: séries e timer continuam.
    await page.reload();
    await expect(page.getByRole("heading", { level: 1, name: "Upper E2E" })).toBeVisible();
    const reloaded = exerciseCard(page, "Supino E2E");
    await expect(reloaded.getByRole("button", { name: "Desfazer série 1 de Supino E2E" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(reloaded.getByLabel("Carga da série 1 de Supino E2E (kg)")).toHaveValue("42,5");
    await expect(reloaded.getByTestId("pr-badge")).toBeVisible();
    await expect(restTimer(page)).toBeVisible();

    // Timer: +15 s e pular.
    const before = await page.getByTestId("rest-remaining").textContent();
    await page.getByRole("button", { name: "Mais 15 segundos" }).click();
    await expect(page.getByTestId("rest-remaining")).not.toHaveText(before!);
    await page.getByRole("button", { name: "Pular descanso" }).click();
    await expect(restTimer(page)).toBeHidden();

    // Série 2 sem digitar: ✓ usa o anterior (40 × 8).
    await reloaded.getByRole("button", { name: "Concluir série 2 de Supino E2E" }).click();
    await expect(reloaded.getByLabel("Carga da série 2 de Supino E2E (kg)")).toHaveValue("40");
    await expect(reloaded.getByLabel("Repetições da série 2 de Supino E2E")).toHaveValue("8");

    await finishWorkout(page);
    await expect(page.getByRole("heading", { level: 1, name: "Treino salvo" })).toBeVisible();
    const summary = page.getByTestId("workout-summary");
    await expect(summary).toContainText("Séries2");
    await expect(summary).toContainText("PRs3"); // carga, volume e 1RM
    await expect(page.getByRole("region", { name: "Recordes batidos" })).toContainText("Supino E2E");

    await page.getByRole("link", { name: "Ver no histórico" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Upper E2E" })).toBeVisible();
    await expect(exerciseCard(page, "Supino E2E")).toContainText("42,5 kg × 10");
    // Remada não teve série concluída: fica fora do histórico.
    await expect(exerciseCard(page, "Remada E2E")).toHaveCount(0);

    await page.goto("/treino/historico");
    await expect(page.getByTestId("history-item").first()).toContainText("Upper E2E");
    await expect(page.getByTestId("history-item").first()).toContainText("3 PRs");

    // A sequência andou: o próximo agora é o Lower.
    await page.goto("/treino");
    await expect(page.getByTestId("next-workout-card")).toContainText("Lower E2E");
  });

  test("finalizar offline: fica pendente e aparece no histórico ao reconectar", async ({ page, context }) => {
    const name = await startSuggested(page);
    const card = page.getByTestId("session-exercise").first();
    await card.getByRole("button", { name: /^Concluir série 1 de / }).click(); // usa o anterior
    await expect(card.getByRole("button", { name: /^Desfazer série 1 de / })).toBeVisible();

    await context.setOffline(true);
    await finishWorkout(page);
    await expect(page.getByTestId("sync-pending")).toContainText("Aguardando envio");
    await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();

    await context.setOffline(false);
    // O evento `online` (ou o backoff) reenvia e limpa o aparelho.
    await expect(page.getByRole("heading", { level: 1, name: "Nenhum treino em andamento" })).toBeVisible({
      timeout: 15_000,
    });

    await page.goto("/treino/historico");
    await expect(page.getByTestId("history-item").first()).toContainText(name);
  });

  test("histórico: editar carga e excluir com confirmação", async ({ page }) => {
    await page.goto("/treino/historico");
    const items = page.getByTestId("history-item");
    await expect(items.first()).toBeVisible();
    const countBefore = await items.count();
    await items.last().click(); // o treino do seed mais antigo (Upper, 12/10)
    await expect(page.getByRole("heading", { level: 1, name: "Upper E2E" })).toBeVisible();

    await page.getByRole("button", { name: "Editar" }).click();
    const field = page.getByLabel("Carga da série 1 de Supino E2E (kg)");
    await field.fill("41");
    const saved = page.waitForResponse(
      (r) => r.url().includes("/rest/v1/workout_sets") && r.request().method() === "PATCH",
    );
    await field.blur();
    expect((await saved).ok()).toBe(true);
    await page.reload();
    await expect(exerciseCard(page, "Supino E2E")).toContainText("41 kg × 10");

    await page.getByRole("button", { name: "Excluir treino" }).click();
    const dialog = page.getByRole("dialog", { name: "Excluir este treino?" });
    await dialog.getByRole("button", { name: "Cancelar" }).click();
    await expect(dialog).toBeHidden();

    await page.getByRole("button", { name: "Excluir treino" }).click();
    const deleted = page.waitForResponse(
      (r) => r.url().includes("/rest/v1/workouts") && r.request().method() === "DELETE",
    );
    await page.getByRole("dialog", { name: "Excluir este treino?" }).getByRole("button", { name: "Excluir treino" }).click();
    expect((await deleted).ok()).toBe(true);
    await expect(page).toHaveURL(/\/treino\/historico$/);
    await page.reload();
    await expect(items).toHaveCount(countBefore - 1);
  });
});
