import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { dayInSaoPaulo } from "../../src/lib/domain/day";
import {
  createDisposableUser,
  deleteDisposableUser,
  seedMealPlan,
  seedNutrition,
  seedProfile,
  seedSystemHabits,
  seedTrainingPlan,
  seedWorkout,
  type DisposableUser,
} from "./disposable-user";
import { loginAndWaitForHome } from "./fixtures";

const THEME_STORAGE_KEY = "bctrl.theme"; // src/components/providers/theme-provider.tsx

// WCAG 2.1 A/AA; o critério da v1 é 0 violações "serious" ou "critical".
const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];
const BLOCKING = new Set(["serious", "critical"]);

async function audit(page: Page, label: string) {
  const { violations } = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  return violations
    .filter((v) => BLOCKING.has(v.impact ?? ""))
    .map((v) => `${label} · ${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(" ")).slice(0, 4).join(" | ")}`);
}

/** Página pronta: título visível e nenhum esqueleto de carregamento. */
async function ready(page: Page) {
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  await expect(page.locator('[data-slot="skeleton"]')).toHaveCount(0);
}

function setTheme(page: Page, theme: "light" | "dark") {
  return page.addInitScript(([key, value]) => localStorage.setItem(key, value), [THEME_STORAGE_KEY, theme] as const);
}

for (const theme of ["dark", "light"] as const) {
  test.describe(`acessibilidade (axe) · tema ${theme === "dark" ? "escuro" : "claro"}`, () => {
    let user: DisposableUser;
    let routes: string[];

    test.beforeEach(async ({ page }) => {
      user = await createDisposableUser("e2e-a11y");
      const plan = await seedTrainingPlan(user);
      const meals = await seedMealPlan(user);
      await seedNutrition(user, meals, { weightKg: 80 });
      await seedProfile(user);
      await seedSystemHabits(user);
      const workout = await seedWorkout(user, {
        routine: plan.upper,
        day: dayInSaoPaulo(new Date()),
        sets: [[plan.exercises.supino, [[42.5, 8, ["weight"]], [40, 10]]]],
      });
      routes = [
        "/",
        "/treino",
        `/treino/rotinas/${plan.upper}`,
        "/treino/exercicios",
        "/treino/historico",
        `/treino/historico/${workout}`,
        `/treino/historico/${workout}/story`,
        "/treino/sessao",
        "/evolucao",
        `/evolucao/${plan.exercises.supino}`,
        "/comida",
        "/comida/plano",
        "/habitos",
        "/tarefas",
        "/perfil",
        "/perfil/dados",
      ];
      await setTheme(page, theme);
    });
    test.afterEach(async () => {
      await deleteDisposableUser(user);
    });

    test("login e todas as rotas do app sem violações serious/critical", async ({ page }) => {
      test.setTimeout(120_000);
      const found: string[] = [];

      await page.goto("/login");
      await expect(page.locator("html")).toHaveClass(theme === "dark" ? /dark/ : /^(?!.*\bdark\b)/);
      found.push(...(await audit(page, "/login")));

      await loginAndWaitForHome(page, user.email, user.password);
      for (const route of routes) {
        await page.goto(route);
        await ready(page);
        found.push(...(await audit(page, route)));
      }

      // Estados que só existem com interação: tooltip e tabela do heatmap, sheet aberto e
      // sessão ativa com timer.
      await page.goto("/perfil");
      await ready(page);
      await page.getByRole("button", { name: "Ver tabela por mês" }).click();
      await page.getByTestId("control-heatmap").locator(`rect[data-date="${dayInSaoPaulo(new Date())}"]`).click();
      await expect(page.getByRole("tooltip")).toBeVisible();
      found.push(...(await audit(page, "/perfil (tooltip e tabela do heatmap)")));

      await page.goto("/comida");
      await page.getByTestId("meal-card").first().click();
      await expect(page.getByRole("dialog")).toBeVisible();
      found.push(...(await audit(page, "/comida (sheet de opções)")));
      await page.getByRole("button", { name: "Adicionar alimento" }).click();
      const add = page.getByRole("dialog", { name: "Adicionar alimento" });
      await add.getByLabel("Buscar alimento").fill("arroz");
      await add.getByRole("button", { name: /^Arroz, integral, cozido/ }).click();
      await expect(add.getByRole("textbox", { name: "Quantidade", exact: true })).toBeVisible();
      found.push(...(await audit(page, "/comida (adicionar alimento fora do plano)")));

      await page.goto("/treino");
      await page.getByTestId("next-workout-card").getByRole("button", { name: "Iniciar treino" }).click();
      await expect(page).toHaveURL(/\/treino\/sessao$/);
      await page.getByLabel(/^Carga da série 1 de/).first().fill("60");
      await page.getByLabel(/^Repetições da série 1 de/).first().fill("10");
      await page.getByRole("button", { name: /^Concluir série 1 de/ }).first().click();
      await expect(page.getByRole("region", { name: "Descanso" })).toBeVisible();
      found.push(...(await audit(page, "/treino/sessao (ativa)")));

      expect(found, found.join("\n")).toEqual([]);
    });
  });
}

test.describe("teclado no desktop", () => {
  test.skip(({ isMobile }) => isMobile, "navegação por teclado é requisito do PC");

  test("pular para o conteúdo e percorrer a navegação com foco visível", async ({ page }) => {
    await loginAndWaitForHome(page);
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1, name: "Hoje" })).toBeVisible();

    // Primeiro Tab: o atalho aparece e leva o foco para o conteúdo.
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "Pular para o conteúdo" });
    await expect(skip).toBeFocused();
    await expect(skip).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(page.locator("main#conteudo")).toBeFocused();

    // A navegação lateral é alcançável por Tab e o item focado tem contorno.
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1, name: "Hoje" })).toBeVisible();
    await page.keyboard.press("Tab"); // atalho
    await page.keyboard.press("Tab"); // logo
    await page.keyboard.press("Tab"); // Hoje
    const hoje = page.getByRole("navigation", { name: "Navegação principal" }).getByRole("link", { name: "Hoje" });
    await expect(hoje).toBeFocused();
    const outline = await hoje.evaluate((el) => getComputedStyle(el).outlineStyle + getComputedStyle(el).boxShadow);
    expect(outline).not.toBe("nonenone");

    await page.keyboard.press("Tab");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/treino$/);
  });
});
