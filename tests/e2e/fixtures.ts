import { expect, type Page } from "@playwright/test";

// Usuário que só existe no Supabase local de testes.
export const TEST_USER = {
  email: "e2e@bctrl.test",
  password: "e2e-local-only-123",
};

export async function login(page: Page, email = TEST_USER.email, password = TEST_USER.password) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
}

export async function loginAndWaitForHome(page: Page) {
  await login(page);
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { level: 1, name: "Hoje" })).toBeVisible();
}
