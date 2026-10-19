import { expect, type Page } from "@playwright/test";
import { TEST_USER } from "../support/e2e-user";

export { TEST_USER };

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
