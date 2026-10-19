import { expect, test, type Page } from "@playwright/test";
import { createDisposableUser, deleteDisposableUser, seedSystemHabits, type DisposableUser } from "./disposable-user";
import { loginAndWaitForHome } from "./fixtures";

const habitCard = (page: Page, name: string) =>
  page.getByTestId("habit-card").filter({ has: page.getByRole("heading", { name, exact: true }) });
const total = (page: Page, name: string) => habitCard(page, name).getByTestId("habit-total");
const sheet = (page: Page) => page.getByRole("dialog");

// Um usuário novo por teste: cada um parte dos mesmos hábitos do sistema, em qualquer ordem.
test.describe("hábitos", () => {
  let user: DisposableUser;

  test.beforeEach(async ({ page }) => {
    user = await createDisposableUser("e2e-habitos");
    await seedSystemHabits(user);
    await loginAndWaitForHome(page, user.email, user.password);
    await page.goto("/habitos");
    await expect(page.getByRole("heading", { level: 1, name: "Hábitos" })).toBeVisible();
  });
  test.afterEach(async () => {
    await deleteDisposableUser(user);
  });

  test("registrar cardio de 30 min / 4 km / 250 kcal sobe a barra para 30/150", async ({ page }) => {
    // Treino é derivado dos workouts: somente leitura.
    await expect(total(page, "Treino")).toContainText("0/4");
    await expect(habitCard(page, "Treino").getByRole("button", { name: /Registrar|Marcar/ })).toHaveCount(0);

    await expect(total(page, "Cardio")).toContainText("0/150");
    await habitCard(page, "Cardio").getByRole("button", { name: "Registrar Cardio" }).click();
    const form = sheet(page).getByRole("form", { name: "Registrar cardio" });
    await form.getByRole("radio", { name: "Esteira" }).click();
    await expect(form.getByRole("radio", { name: "Esteira" })).toHaveAttribute("aria-checked", "true");
    await form.getByLabel("Minutos").fill("30");
    await form.getByLabel("Km (opcional)").fill("4");
    await form.getByLabel("Kcal (opcional)").fill("250");
    await form.getByRole("button", { name: "Registrar cardio" }).click();

    await expect(sheet(page)).toBeHidden();
    await expect(total(page, "Cardio")).toContainText("30/150");
    await expect(habitCard(page, "Cardio").getByRole("progressbar")).toHaveAttribute("aria-valuenow", "30");
    const totals = habitCard(page, "Cardio").getByTestId("cardio-totals");
    await expect(totals).toContainText("4 km");
    await expect(totals).toContainText("250 kcal");
    await expect(habitCard(page, "Cardio")).toContainText("Faltam 120 min");

    // Gravado no banco: sobrevive ao reload, e o registro aparece na lista da semana.
    await page.reload();
    await expect(total(page, "Cardio")).toContainText("30/150");
    await habitCard(page, "Cardio").getByRole("button", { name: "Registrar Cardio" }).click();
    await expect(sheet(page).getByTestId("habit-log")).toContainText("Esteira · 30 min · 4 km · 250 kcal");
  });

  test("marcar abdominal em 1 toque e desfazer", async ({ page }) => {
    await expect(total(page, "Abdominal")).toContainText("0/3");
    await habitCard(page, "Abdominal").getByRole("button", { name: "Marcar Abdominal hoje" }).click();
    await expect(total(page, "Abdominal")).toContainText("1/3");
    await expect(page.getByText("Abdominal: feito hoje")).toBeVisible();

    await page.reload();
    await expect(total(page, "Abdominal")).toContainText("1/3");
    await habitCard(page, "Abdominal").getByRole("button", { name: "Desfazer Abdominal de hoje" }).click();
    await expect(total(page, "Abdominal")).toContainText("0/3");
    await expect(habitCard(page, "Abdominal").getByRole("button", { name: "Marcar Abdominal hoje" })).toBeVisible();

    await page.reload();
    await expect(total(page, "Abdominal")).toContainText("0/3");

    // Suplementos é diário: mostra o dia de hoje.
    const supplements = habitCard(page, "Desjejum/Suplementos");
    await expect(supplements.getByTestId("habit-today")).toContainText("Hoje: pendente");
    await supplements.getByRole("button", { name: "Marcar Desjejum/Suplementos hoje" }).click();
    await expect(supplements.getByTestId("habit-today")).toContainText("Hoje: feito");
    await expect(total(page, "Desjejum/Suplementos")).toContainText("1/7");
  });

  test("sem rolagem horizontal em 375 px (hábitos, sheets e tarefas)", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

    await expect(total(page, "Cardio")).toBeVisible();
    expect(await overflow()).toBeLessThanOrEqual(0);
    await habitCard(page, "Cardio").getByRole("button", { name: "Registrar Cardio" }).click();
    await expect(sheet(page).getByRole("form", { name: "Registrar cardio" })).toBeVisible();
    expect(await overflow()).toBeLessThanOrEqual(0);
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Novo hábito" }).click();
    await sheet(page).getByRole("button", { name: "Quantidade" }).click();
    await expect(sheet(page).getByLabel("Unidade (opcional)")).toBeVisible();
    expect(await overflow()).toBeLessThanOrEqual(0);

    await page.goto("/tarefas");
    const input = page.getByRole("textbox", { name: "Nova tarefa" });
    await input.fill("Uma tarefa com um título bem comprido para ver se quebra a linha sem empurrar a tela".repeat(2));
    await input.press("Enter");
    await expect(page.getByTestId("task-row")).toHaveCount(1);
    expect(await overflow()).toBeLessThanOrEqual(0);
  });

  test("hábito do sistema não tem excluir; customizado é criado, marcado, arquivado e excluído", async ({ page }) => {
    await habitCard(page, "Cardio").getByRole("button", { name: "Editar Cardio" }).click();
    await expect(sheet(page).getByText("Hábito do sistema: dá para editar, mas não excluir.")).toBeVisible();
    await expect(sheet(page).getByRole("button", { name: "Excluir" })).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(sheet(page)).toBeHidden();

    await page.getByRole("button", { name: "Novo hábito" }).click();
    const form = sheet(page).getByRole("form", { name: "Novo hábito" });
    await form.getByLabel("Nome").fill("Ler E2E");
    await expect(form.getByRole("button", { name: "Marcar", exact: true })).toHaveAttribute("aria-pressed", "true");
    await form.getByLabel("Dias por semana").fill("2");
    await form.getByRole("button", { name: "Criar hábito" }).click();
    await expect(sheet(page)).toBeHidden();

    await expect(total(page, "Ler E2E")).toContainText("0/2");
    await habitCard(page, "Ler E2E").getByRole("button", { name: "Marcar Ler E2E hoje" }).click();
    await expect(total(page, "Ler E2E")).toContainText("1/2");
    await page.reload();
    await expect(total(page, "Ler E2E")).toContainText("1/2");

    // Arquivar tira da semana; excluir (com confirmação) apaga de vez.
    await habitCard(page, "Ler E2E").getByRole("button", { name: "Editar Ler E2E" }).click();
    await sheet(page).getByRole("button", { name: "Arquivar" }).click();
    await expect(habitCard(page, "Ler E2E")).toHaveCount(0);
    await page.getByRole("button", { name: /Arquivados/ }).click();
    await page.getByRole("button", { name: "Excluir Ler E2E" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Excluir hábito" }).click();
    await expect(page.getByTestId("archived-habit")).toHaveCount(0);
    await page.reload();
    await expect(total(page, "Cardio")).toBeVisible();
    await expect(page.getByText("Ler E2E")).toHaveCount(0);
  });
});

test.describe("tarefas", () => {
  let user: DisposableUser;

  test.beforeEach(async ({ page }) => {
    user = await createDisposableUser("e2e-tarefas");
    await loginAndWaitForHome(page, user.email, user.password);
  });
  test.afterEach(async () => {
    await deleteDisposableUser(user);
  });

  test("criar com 1 campo + Enter, concluir, desfazer e excluir", async ({ page }) => {
    await page.goto("/tarefas");
    await expect(page.getByText("Nada pendente.")).toBeVisible();

    const input = page.getByRole("textbox", { name: "Nova tarefa" });
    await input.fill("Comprar pão");
    await input.press("Enter");
    await expect(input).toHaveValue("");
    await input.fill("Pagar boleto");
    await input.press("Enter");

    const pending = page.getByRole("list", { name: "Tarefas pendentes" });
    await expect(pending.getByTestId("task-row")).toHaveCount(2);
    await expect(pending.getByTestId("task-row").first()).toContainText("Pagar boleto"); // mais nova no topo

    // Concluir: vai para "Concluídas", que começa recolhida.
    await page.getByRole("checkbox", { name: "Concluir: Comprar pão" }).click();
    await expect(pending.getByTestId("task-row")).toHaveCount(1);
    const doneToggle = page.getByRole("button", { name: /Concluídas/ });
    await expect(doneToggle).toContainText("1");
    await expect(page.getByRole("list", { name: "Tarefas concluídas" })).toHaveCount(0);
    await doneToggle.click();
    await expect(page.getByRole("list", { name: "Tarefas concluídas" })).toContainText("Comprar pão");

    // Gravado: sobrevive ao reload.
    await page.reload();
    await expect(page.getByRole("list", { name: "Tarefas pendentes" }).getByTestId("task-row")).toHaveCount(1);
    await page.getByRole("button", { name: /Concluídas/ }).click();

    // Desfazer a conclusão devolve para as pendentes.
    await page.getByRole("checkbox", { name: "Reabrir: Comprar pão" }).click();
    await expect(page.getByRole("list", { name: "Tarefas pendentes" }).getByTestId("task-row")).toHaveCount(2);

    // Excluir.
    await page.getByRole("button", { name: "Excluir: Pagar boleto" }).click();
    await expect(page.getByText("Pagar boleto")).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole("list", { name: "Tarefas pendentes" }).getByTestId("task-row")).toHaveCount(1);
    await expect(page.getByText("Pagar boleto")).toHaveCount(0);
    await expect(page.getByText("Comprar pão")).toBeVisible();
  });
});
