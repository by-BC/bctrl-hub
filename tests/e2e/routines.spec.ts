import { expect, test, type Page } from "@playwright/test";
import { createDisposableUser, deleteDisposableUser, type DisposableUser } from "./disposable-user";
import { loginAndWaitForHome } from "./fixtures";

/** Espera a gravação (não-GET) na tabela disparada por `action` terminar com sucesso. */
async function saved(page: Page, table: string, action: () => Promise<unknown>) {
  const response = page.waitForResponse(
    (r) => r.url().includes(`/rest/v1/${table}`) && !["GET", "HEAD"].includes(r.request().method()),
  );
  await action();
  expect((await response).ok()).toBe(true);
}

const itemNames = (page: Page) => page.getByTestId("routine-item-name");
const routineCard = (page: Page, name: string) => page.getByTestId("routine-card").filter({ hasText: name });

async function createRoutine(page: Page, name: string) {
  await page.goto("/treino");
  await page.getByRole("button", { name: "Nova rotina" }).click();
  const dialog = page.getByRole("dialog", { name: "Nova rotina" });
  await dialog.getByLabel("Nome da rotina").fill(name);
  await saved(page, "routines", () => dialog.getByRole("button", { name: "Criar rotina" }).click());
  await expect(page).toHaveURL(/\/treino\/rotinas\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
}

/** Cria o exercício pelo seletor e adiciona à rotina aberta. */
async function addNewExercise(page: Page, name: string, group: string) {
  await page.getByRole("button", { name: "Adicionar exercício" }).click();
  const picker = page.getByRole("dialog", { name: "Adicionar exercício" });
  await picker.getByLabel("Buscar exercício").fill(name);
  await picker.getByRole("button", { name: `Criar “${name}”` }).click();
  const form = page.getByRole("dialog", { name: "Novo exercício" });
  await expect(form.getByLabel("Nome do exercício")).toHaveValue(name);
  await form.getByLabel("Grupo muscular").fill(group);
  await saved(page, "routine_exercises", () => form.getByRole("button", { name: "Criar e adicionar" }).click());
  await expect(page.getByRole("dialog")).toBeHidden();
}

test.describe("rotinas e exercícios", () => {
  let user: DisposableUser;

  test.beforeAll(async () => {
    user = await createDisposableUser("e2e-rotinas");
  });
  test.afterAll(async () => {
    await deleteDisposableUser(user);
  });
  test.beforeEach(async ({ page }) => {
    await loginAndWaitForHome(page, user.email, user.password);
  });

  test("cria rotina, adiciona 2 exercícios, reordena e a ordem persiste", async ({ page }) => {
    await createRoutine(page, "Upper E2E");
    await addNewExercise(page, "Supino E2E", "Peito");
    await addNewExercise(page, "Remada E2E", "Costas");
    await expect(itemNames(page)).toHaveText(["Supino E2E", "Remada E2E"]);

    // Botão acessível
    await saved(page, "routine_exercises", () =>
      page.getByRole("button", { name: "Mover Remada E2E para cima" }).click(),
    );
    await expect(itemNames(page)).toHaveText(["Remada E2E", "Supino E2E"]);
    await page.reload();
    await expect(itemNames(page)).toHaveText(["Remada E2E", "Supino E2E"]);

    // Arrastar pelo teclado (espaço pega, seta move, espaço solta)
    const handle = page.getByRole("button", { name: "Arrastar Supino E2E" });
    // O dnd-kit anuncia cada passo na região viva; esperar por ela evita correr na frente da medição.
    await handle.focus();
    await page.keyboard.press("Space");
    await expect(page.getByText("Supino E2E sobre a posição 2 de 2.")).toBeAttached();
    await page.keyboard.press("ArrowUp");
    await expect(page.getByText("Supino E2E sobre a posição 1 de 2.")).toBeAttached();
    await saved(page, "routine_exercises", () => page.keyboard.press("Space"));
    await expect(itemNames(page)).toHaveText(["Supino E2E", "Remada E2E"]);
    await page.reload();
    await expect(itemNames(page)).toHaveText(["Supino E2E", "Remada E2E"]);

    // Remover não pede confirmação: o toast oferece desfazer, que devolve o item na posição.
    await page.getByRole("button", { name: "Remover Supino E2E da rotina" }).click();
    await expect(itemNames(page)).toHaveText(["Remada E2E"]);
    await page.getByRole("button", { name: "Desfazer" }).click();
    await expect(itemNames(page)).toHaveText(["Supino E2E", "Remada E2E"]);
    await expect(async () => {
      await page.reload();
      await expect(itemNames(page)).toHaveText(["Supino E2E", "Remada E2E"], { timeout: 2_000 });
    }).toPass();

    // A lista mostra a rotina com os totais
    await page.getByRole("link", { name: "Treino", exact: true }).first().click();
    await expect(routineCard(page, "Upper E2E")).toContainText("2 exercícios · 6 séries");
  });

  test("editar séries, descanso e observação técnica persiste e aparece na lista", async ({ page }) => {
    await createRoutine(page, "Lower E2E");
    await addNewExercise(page, "Agachamento E2E", "Quadríceps");
    const item = page.getByRole("article", { name: "Agachamento E2E" });

    await saved(page, "routine_exercises", () => item.getByRole("button", { name: "Aumentar séries" }).click());
    await saved(page, "routine_exercises", () => item.getByRole("button", { name: "Aumentar descanso" }).click());
    await item.getByLabel("Observação técnica").fill("Descer até 90°, 3 s na excêntrica");
    await saved(page, "routine_exercises", () => item.getByLabel("Observação técnica").blur());
    await page.getByLabel("Observações da rotina").fill("Mobilidade de quadril antes");
    await saved(page, "routines", () => page.getByLabel("Observações da rotina").blur());

    await page.reload();
    const reloaded = page.getByRole("article", { name: "Agachamento E2E" });
    await expect(reloaded.getByLabel("Observação técnica")).toHaveValue("Descer até 90°, 3 s na excêntrica");
    await expect(reloaded.getByRole("group", { name: "Séries" })).toContainText("4");
    await expect(reloaded.getByRole("group", { name: "Descanso" })).toContainText("2:15");
    await expect(page.getByLabel("Observações da rotina")).toHaveValue("Mobilidade de quadril antes");

    // Volta à lista sem recarregar: o card já reflete a mudança.
    await saved(page, "routine_exercises", () =>
      reloaded.getByRole("button", { name: "Aumentar séries" }).click(),
    );
    await page.getByRole("link", { name: "Treino", exact: true }).first().click();
    await expect(routineCard(page, "Lower E2E")).toContainText("1 exercício · 5 séries");
  });

  test("reordenar rotinas na lista persiste após recarregar", async ({ page }) => {
    await createRoutine(page, "Seq A E2E");
    await createRoutine(page, "Seq B E2E");
    await page.goto("/treino");
    const order = async () => {
      const names = await page.getByTestId("routine-card").getByRole("link").allTextContents();
      return names.filter((n) => n.includes("Seq ")).map((n) => n.match(/Seq [AB] E2E/)![0]);
    };
    await expect.poll(order).toEqual(["Seq A E2E", "Seq B E2E"]);
    await saved(page, "routines", () => page.getByRole("button", { name: "Mover Seq B E2E para cima" }).click());
    await expect.poll(order).toEqual(["Seq B E2E", "Seq A E2E"]);
    await page.reload();
    await expect.poll(order).toEqual(["Seq B E2E", "Seq A E2E"]);
  });

  test("arquivar tira a rotina da lista ativa e restaurar devolve", async ({ page }) => {
    await createRoutine(page, "Arquivar E2E");
    await page.getByRole("button", { name: "Arquivar ou excluir rotina" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("button", { name: "Excluir rotina" })).toBeVisible(); // sem treinos
    await saved(page, "routines", () => dialog.getByRole("button", { name: "Arquivar rotina" }).click());
    await expect(page).toHaveURL(/\/treino$/);

    await expect(routineCard(page, "Arquivar E2E")).toHaveCount(0);
    const archived = page.getByRole("region", { name: /Arquivadas/ });
    await expect(archived).toContainText("Arquivar E2E");
    await page.reload();
    await expect(routineCard(page, "Arquivar E2E")).toHaveCount(0);

    await saved(page, "routines", () => page.getByRole("button", { name: "Restaurar Arquivar E2E" }).click());
    await expect(routineCard(page, "Arquivar E2E")).toHaveCount(1);
  });

  test("excluir rotina sem treinos pede confirmação e remove", async ({ page }) => {
    await createRoutine(page, "Excluir E2E");
    await page.getByRole("button", { name: "Arquivar ou excluir rotina" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Cancelar" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Excluir E2E" })).toBeVisible();

    await page.getByRole("button", { name: "Arquivar ou excluir rotina" }).click();
    await saved(page, "routines", () => page.getByRole("dialog").getByRole("button", { name: "Excluir rotina" }).click());
    await expect(page).toHaveURL(/\/treino$/);
    await page.reload();
    await expect(page.getByText("Excluir E2E")).toHaveCount(0);
  });

  test("biblioteca: nome de exercício repetido mostra erro claro", async ({ page }) => {
    await page.goto("/treino/exercicios");
    await page.getByRole("button", { name: "Novo exercício" }).click();
    let dialog = page.getByRole("dialog", { name: "Novo exercício" });
    await dialog.getByLabel("Nome do exercício").fill("Leg press E2E");
    await dialog.getByLabel("Grupo muscular").fill("Quadríceps");
    await saved(page, "exercises", () => dialog.getByRole("button", { name: "Criar exercício" }).click());
    await expect(page.getByRole("list", { name: "Biblioteca de exercícios" })).toContainText("Leg press E2E");

    // Mesmo nome com outra caixa/espaços
    await page.getByRole("button", { name: "Novo exercício" }).click();
    dialog = page.getByRole("dialog", { name: "Novo exercício" });
    await dialog.getByLabel("Nome do exercício").fill("  leg press e2e ");
    await dialog.getByRole("button", { name: "Criar exercício" }).click();
    await expect(dialog.getByRole("alert")).toHaveText("Já existe um exercício chamado “leg press e2e”.");
    await dialog.getByRole("button", { name: "Cancelar" }).click();

    // Editar: renomear para um nome que já existe também é recusado
    await page.getByRole("button", { name: "Novo exercício" }).click();
    dialog = page.getByRole("dialog", { name: "Novo exercício" });
    await dialog.getByLabel("Nome do exercício").fill("Cadeira extensora E2E");
    await saved(page, "exercises", () => dialog.getByRole("button", { name: "Criar exercício" }).click());
    await page.getByRole("button", { name: "Editar Cadeira extensora E2E" }).click();
    dialog = page.getByRole("dialog", { name: "Editar exercício" });
    await dialog.getByLabel("Nome do exercício").fill("Leg press E2E");
    await dialog.getByRole("button", { name: "Salvar exercício" }).click();
    await expect(dialog.getByRole("alert")).toHaveText("Já existe um exercício chamado “Leg press E2E”.");

    // Editar de verdade funciona e persiste
    await dialog.getByLabel("Nome do exercício").fill("Extensora E2E");
    await saved(page, "exercises", () => dialog.getByRole("button", { name: "Salvar exercício" }).click());
    await page.reload();
    await page.getByLabel("Buscar exercício").fill("extensora");
    await expect(page.getByRole("list", { name: "Biblioteca de exercícios" })).toHaveText(/Extensora E2E/);
  });
});

test.describe("rotinas do seed (somente leitura)", () => {
  test("as 4 rotinas aparecem na ordem com 8, 6, 8 e 6 exercícios, sem rolagem horizontal em 375 px", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await loginAndWaitForHome(page);
    await page.goto("/treino");

    const cards = page.getByTestId("routine-card");
    await expect(cards).toHaveCount(4);
    for (const [i, [name, count]] of (
      [
        ["Treino A", 8],
        ["Treino B", 6],
        ["Treino C", 8],
        ["Treino D", 6],
      ] as const
    ).entries()) {
      await expect(cards.nth(i)).toContainText(name);
      await expect(cards.nth(i)).toContainText(`${count} exercícios`);
    }
    const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(await overflow()).toBeLessThanOrEqual(0);

    await cards.first().getByRole("link").click();
    await expect(page.getByRole("heading", { level: 1, name: "Treino A" })).toBeVisible();
    await expect(page.getByTestId("routine-item")).toHaveCount(8);
    expect(await overflow()).toBeLessThanOrEqual(0);
  });
});
