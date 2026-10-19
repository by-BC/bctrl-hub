import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import {
  countRows,
  createDisposableUser,
  deleteDisposableUser,
  seedMealPlan,
  seedSystemHabits,
  type DisposableUser,
} from "./disposable-user";
import { loginAndWaitForHome } from "./fixtures";

const QUEUE_KEY = "bctrl.queryCache";
/** Reenvio depois de reabrir: a página precisa carregar (e, no `next dev`, compilar) antes. */
const SYNC = { timeout: 15_000 };

/** Indicador visível (celular: no topo; desktop: na barra lateral). Apagado quando não há nada esperando. */
const syncStatus = (page: Page) =>
  page.locator('[data-testid="sync-status"]:not([data-state="idle"])').filter({ visible: true });

/** Gravações salvas no aparelho (fila offline persistida). */
const queued = (page: Page) =>
  page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "null")?.clientState?.mutations?.length ?? 0, QUEUE_KEY);

/** Sem rede, a gravação fica na fila: indicador com a contagem e o `localStorage` salvo. */
async function expectQueuedOffline(page: Page) {
  await expect(syncStatus(page)).toHaveText("Offline · 1 pendente");
  await expect.poll(() => queued(page)).toBe(1);
}

/** Fecha o app ainda sem rede, a conexão volta e o app é aberto de novo em `path`. */
async function reopenOnline(context: BrowserContext, page: Page, path: string) {
  await page.close();
  await context.setOffline(false);
  const next = await context.newPage();
  await next.goto(path);
  return next;
}

/**
 * Fila offline geral (techspec, Pontos de Integração): refeição, hábito e tarefa marcados sem
 * rede, app fechado e reaberto com a conexão de volta: tudo chega ao banco. Sem service worker
 * (o app não é PWA, fora do escopo do PRD), a página não recarrega sem rede: "reabrir" é fechar
 * a aba offline e abrir outra online, que restaura a fila do `localStorage` e reenvia.
 */
test.describe("fila offline geral", () => {
  let user: DisposableUser;

  test.beforeEach(async ({ page }) => {
    user = await createDisposableUser("e2e-offline");
    await seedMealPlan(user);
    await seedSystemHabits(user);
    await loginAndWaitForHome(page, user.email, user.password);
  });
  test.afterEach(async ({ context }) => {
    await context.setOffline(false);
    await deleteDisposableUser(user);
  });

  test("refeição, hábito e tarefa marcados offline são gravados ao reabrir o app online", async ({ page, context }) => {
    test.setTimeout(90_000); // 3 ciclos de fechar e reabrir o app
    // Refeição
    await page.goto("/comida");
    const cafe = page.getByTestId("meal-card").filter({ hasText: "Café da manhã" });
    await expect(cafe).toContainText("Pendente");
    await context.setOffline(true);
    await expect(syncStatus(page)).toHaveText("Offline");
    await cafe.click();
    await page.getByRole("dialog").getByRole("button", { name: "Comi a Opção 2: Iogurte" }).click();
    await expect(cafe).toContainText("Feita");
    await expectQueuedOffline(page);
    expect(await countRows(user, "meal_logs")).toBe(0);

    // Hábito (o app reaberto online já reenvia a refeição)
    page = await reopenOnline(context, page, "/habitos");
    await expect.poll(() => countRows(user, "meal_logs"), SYNC).toBe(1);
    const abs = page.getByTestId("habit-card").filter({ has: page.getByRole("heading", { name: "Abdominal", exact: true }) });
    await expect(abs.getByTestId("habit-total")).toContainText("0/3");
    await context.setOffline(true);
    await abs.getByRole("button", { name: "Marcar Abdominal hoje" }).click();
    await expect(abs.getByTestId("habit-total")).toContainText("1/3");
    await expectQueuedOffline(page);
    expect(await countRows(user, "habit_logs")).toBe(0);

    // Tarefa
    page = await reopenOnline(context, page, "/tarefas");
    await expect.poll(() => countRows(user, "habit_logs"), SYNC).toBe(1);
    const input = page.getByRole("textbox", { name: "Nova tarefa" });
    await expect(page.getByText("Nada pendente.")).toBeVisible();
    await context.setOffline(true);
    await input.fill("Comprar whey");
    await input.press("Enter");
    await expect(page.getByRole("list", { name: "Tarefas pendentes" })).toContainText("Comprar whey");
    await expectQueuedOffline(page);
    expect(await countRows(user, "tasks")).toBe(0);

    // De volta: a fila esvazia e as telas mostram o que veio do banco.
    page = await reopenOnline(context, page, "/tarefas");
    await expect.poll(() => countRows(user, "tasks"), SYNC).toBe(1);
    await expect(page.getByRole("list", { name: "Tarefas pendentes" })).toContainText("Comprar whey");
    await expect.poll(() => queued(page)).toBe(0);
    await expect(syncStatus(page)).toHaveCount(0);

    await page.goto("/comida");
    await expect(page.getByTestId("meal-card").filter({ hasText: "Café da manhã" })).toContainText("Opção 2: Iogurte");
  });

  test("com o app aberto, a gravação pausada sai sozinha quando a rede volta", async ({ page, context }) => {
    await page.goto("/tarefas");
    await expect(page.getByText("Nada pendente.")).toBeVisible();
    await context.setOffline(true);
    const input = page.getByRole("textbox", { name: "Nova tarefa" });
    await input.fill("Pagar academia");
    await input.press("Enter");
    await expect(syncStatus(page)).toHaveText("Offline · 1 pendente");

    await context.setOffline(false);
    await expect.poll(() => countRows(user, "tasks"), SYNC).toBe(1);
    await expect(syncStatus(page)).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole("list", { name: "Tarefas pendentes" })).toContainText("Pagar academia");
  });
});
