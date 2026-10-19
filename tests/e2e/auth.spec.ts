import { expect, test } from "@playwright/test";
import { login, loginAndWaitForHome } from "./fixtures";

test.describe("acesso", () => {
  for (const path of ["/", "/treino", "/treino/sessao", "/comida", "/habitos", "/tarefas", "/evolucao"]) {
    test(`sem sessão, ${path} redireciona para /login`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login$/);
      await expect(page.getByRole("button", { name: "Entrar" })).toBeVisible();
    });
  }

  test("senha errada mostra erro sem sair da tela", async ({ page }) => {
    await login(page, undefined, "senha-errada");
    await expect(page.locator("#login-error")).toHaveText("E-mail ou senha incorretos.");
    await expect(page).toHaveURL(/\/login$/);
  });

  test("login válido leva ao Hoje e a sessão sobrevive ao reload", async ({ page }) => {
    await loginAndWaitForHome(page);
    await page.reload();
    await expect(page.getByRole("heading", { level: 1, name: "Hoje" })).toBeVisible();
  });

  test("com sessão, /login volta para o Hoje", async ({ page }) => {
    await loginAndWaitForHome(page);
    await page.goto("/login");
    await expect(page).toHaveURL(/\/$/);
  });

  test("sair volta para /login e bloqueia as telas", async ({ page }) => {
    await loginAndWaitForHome(page);
    await page.getByRole("button", { name: "Sair" }).first().click();
    await expect(page).toHaveURL(/\/login$/);
    await page.goto("/treino");
    await expect(page).toHaveURL(/\/login$/);
  });
});
