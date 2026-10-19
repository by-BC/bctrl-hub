import { expect, test } from "@playwright/test";
import { loginAndWaitForHome } from "./fixtures";

test.beforeEach(async ({ page }) => {
  await loginAndWaitForHome(page);
});

test("navega entre as seções e marca a ativa", async ({ page, isMobile }) => {
  const nav = page.getByRole("navigation", { name: "Navegação principal" }).filter({ visible: true });

  for (const [label, heading] of [
    ["Treino", "Treino"],
    ["Comida", "Comida"],
    ["Hábitos", "Hábitos"],
    ["Tarefas", "Tarefas"],
    ["Hoje", "Hoje"],
  ] as const) {
    await nav.getByRole("link", { name: label }).click();
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    await expect(nav.getByRole("link", { name: label })).toHaveAttribute("aria-current", "page");
  }

  // Evolução fica na lateral do desktop
  if (!isMobile) {
    await nav.getByRole("link", { name: "Evolução" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Evolução" })).toBeVisible();
  }
});

test("tema escuro é o padrão e a escolha persiste após recarregar", async ({ page }) => {
  const html = page.locator("html");
  await expect(html).toHaveClass(/dark/);

  await page.getByRole("button", { name: "Ativar tema claro" }).filter({ visible: true }).click();
  await expect(html).not.toHaveClass(/dark/);

  await page.reload();
  await expect(html).not.toHaveClass(/dark/);
  await page.getByRole("button", { name: "Ativar tema escuro" }).filter({ visible: true }).click();
  await expect(html).toHaveClass(/dark/);
});

test("sem rolagem horizontal na largura do celular", async ({ page }) => {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
