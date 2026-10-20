import { expect, test, type Page } from "@playwright/test";
import { createDisposableUser, deleteDisposableUser, seedMealPlan, type DisposableUser } from "./disposable-user";
import { loginAndWaitForHome } from "./fixtures";

const sheet = (page: Page) => page.getByRole("dialog");
const mealCard = (page: Page, name: string) => page.getByTestId("meal-card").filter({ hasText: name });

/**
 * Task 4.0 v2: vincular um item do plano a um alimento da TACO no editor e ajustar os valores
 * de outro; os macros da opção mudam em /comida (sheet e card da refeição marcada).
 * Plano fictício (`seedMealPlan`): Almoço → "Prato feito" = Arroz 150 g + Frango 120 g.
 */
test.describe("macros do plano alimentar (TACO)", () => {
  let user: DisposableUser;

  test.beforeEach(async ({ page }) => {
    user = await createDisposableUser("e2e-nutricao");
    await seedMealPlan(user);
    await loginAndWaitForHome(page, user.email, user.password);
  });
  test.afterEach(async () => {
    await deleteDisposableUser(user);
  });

  test("vincula o arroz na TACO, ajusta o frango e vê os macros da opção em /comida", async ({ page }) => {
    // Antes: nenhum item vinculado.
    await page.goto("/comida");
    await mealCard(page, "Almoço").click();
    const before = sheet(page).getByRole("article", { name: "Opção 1: Prato feito" });
    await expect(before.getByTestId("option-macros")).toContainText("0 kcal");
    await expect(before.getByTestId("unresolved-items")).toHaveText("2 itens sem valor");
    await page.keyboard.press("Escape");

    // Editor: vincular o item 1 a "Arroz, integral, cozido" (busca sem acento) com as gramas da quantidade.
    await page.goto("/comida/plano");
    const almoco = page.getByRole("article", { name: "Almoço" });
    await almoco.getByRole("button", { name: /Opção 1\s*Prato feito/ }).click();
    const form = almoco.getByRole("form", { name: "Editar Opção 1" });
    await form.getByRole("button", { name: "Item 1: vincular alimento" }).click();

    const picker = page.getByRole("dialog", { name: "Alimento" });
    await expect(picker).toContainText("Fonte: TACO 4ª ed. — NEPA/Unicamp");
    await picker.getByLabel("Buscar alimento").fill("arroz integral cozido");
    await picker.getByRole("button", { name: /^Arroz, integral, cozido/ }).click();
    await expect(picker).toBeHidden();

    const items = form.getByTestId("item-nutrition");
    await expect(items.nth(0).getByTestId("item-food")).toHaveText("Arroz, integral, cozido");
    await expect(form.getByLabel("Item 1: gramas")).toHaveAttribute("placeholder", "150");
    await expect(items.nth(0)).toContainText("vazio usa 150");
    await expect(items.nth(0).getByTestId("item-macros")).toHaveText("185 kcal · P 3,9 g · C 38,7 g · G 1,5 g");
    await expect(items.nth(1).getByTestId("item-macros")).toContainText("Sem valor");

    // Item 2 sem alimento: valores digitados para o item inteiro.
    await form.getByRole("button", { name: "Ajustar valores do item 2" }).click();
    await form.getByLabel("Item 2: kcal").fill("190");
    await form.getByLabel("Item 2: Proteína (g)").fill("36");
    await form.getByLabel("Item 2: Carboidrato (g)").fill("0");
    await form.getByLabel("Item 2: Gordura (g)").fill("4,5");
    await expect(items.nth(1).getByTestId("item-macros")).toHaveText("190 kcal · P 36 g · C 0 g · G 4,5 g");

    await form.getByRole("button", { name: "Salvar opção" }).click();
    await expect(page.getByTestId("save-status")).toHaveText("Salvo");
    await expect(form.getByRole("button", { name: "Salvar opção" })).toBeDisabled();
    await expect(almoco.getByTestId("option-macros").first()).toContainText("375 kcal");

    // /comida: a opção mostra o total, sem aviso; marcada, o card também.
    await page.goto("/comida");
    await mealCard(page, "Almoço").click();
    const option = sheet(page).getByRole("article", { name: "Opção 1: Prato feito" });
    await expect(option.getByTestId("option-macros")).toContainText("375 kcal");
    await expect(option.getByTestId("option-macros")).toContainText("P 39,9 g");
    await expect(option.getByTestId("unresolved-items")).toHaveCount(0);
    await option.getByRole("button", { name: "Comi a Opção 1: Prato feito" }).click();
    await expect(sheet(page)).toBeHidden();
    await expect(mealCard(page, "Almoço").getByTestId("option-macros")).toContainText("375 kcal");

    // Outra opção sem vínculo continua avisando.
    await mealCard(page, "Café da manhã").click();
    await expect(
      sheet(page).getByRole("article", { name: "Opção 1: Tapioca" }).getByTestId("unresolved-items"),
    ).toHaveText("2 itens sem valor");
  });

  test("item à vontade não soma kcal nem conta como sem valor", async ({ page }) => {
    await page.goto("/comida/plano");
    const jantar = page.getByRole("article", { name: "Jantar" });
    await jantar.getByRole("button", { name: /Opção 2\s*Sopa/ }).click();
    const form = jantar.getByRole("form", { name: "Editar Opção 2" });
    await form.getByLabel("Item 1: quantidade").fill("à vontade");
    await expect(form.getByRole("checkbox", { name: "Item 1: à vontade (0 kcal)" })).toBeChecked();
    await expect(form.getByTestId("item-macros")).toHaveText("À vontade: não soma kcal");
    await form.getByRole("button", { name: "Salvar opção" }).click();
    await expect(page.getByTestId("save-status")).toHaveText("Salvo");

    await page.goto("/comida");
    await mealCard(page, "Jantar").click();
    const option = sheet(page).getByRole("article", { name: "Opção 2: Sopa" });
    await expect(option.getByTestId("option-macros")).toContainText("0 kcal");
    await expect(option.getByTestId("unresolved-items")).toHaveCount(0);
  });
});
