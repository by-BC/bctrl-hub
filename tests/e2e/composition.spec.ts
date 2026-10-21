import { expect, test, type Page } from "@playwright/test";
import { dayInSaoPaulo } from "../../src/lib/domain/day";
import { addDays } from "../../src/lib/domain/stats";
import { countRows, createDisposableUser, deleteDisposableUser, seedMeasurements, type DisposableUser } from "./disposable-user";
import { loginAndWaitForHome } from "./fixtures";

/**
 * v3 (task 3.0): tela de composição. Registrar (card + peso da Evolução), validação de faixa,
 * editar e excluir com confirmação, gráficos com período e "ver dados". Sem offline.
 */

const today = dayInSaoPaulo(new Date());
const chart = (page: Page, title: string) => page.getByRole("figure", { name: title });
const metricCard = (page: Page, key: string) => page.getByTestId("latest-measurement").locator(`[data-metric="${key}"]`);

async function openNewMeasurement(page: Page) {
  await page.getByRole("button", { name: "Nova medição" }).click();
  const form = page.getByRole("form", { name: "Nova medição" });
  await expect(form).toBeVisible();
  return form;
}

test.describe("composição corporal", () => {
  let user: DisposableUser;

  test.beforeEach(async ({ page }) => {
    user = await createDisposableUser("e2e-composicao");
    await loginAndWaitForHome(page, user.email, user.password);
  });
  test.afterEach(async () => {
    await deleteDisposableUser(user);
  });

  test("registrar a medição atualiza o card e o peso da Evolução (origem balança)", async ({ page }) => {
    await seedMeasurements(user, [
      { at: `${addDays(today, -10)} 07:00`, weight_kg: 84, body_fat_pct: 22, skeletal_muscle_kg: 35, visceral_fat: 10, lean_mass_kg: 64 },
    ]);

    // Atalho a partir da seção de peso.
    await page.goto("/evolucao");
    await page.getByRole("region", { name: "Peso corporal" }).getByRole("link", { name: "Composição corporal" }).click();
    await expect(page).toHaveURL(/\/evolucao\/composicao$/);
    await expect(page.getByRole("heading", { level: 1, name: "Composição" })).toBeVisible();

    const form = await openNewMeasurement(page);
    // Data e hora padrão: agora (hoje).
    await expect(form.getByLabel("Data e hora")).toHaveValue(new RegExp(`^${today}T\\d{2}:\\d{2}$`));
    await form.getByLabel(/^Peso \(kg\)/).fill("83,2");
    await form.getByLabel("Gordura corporal (%)").fill("21,4");
    await form.getByLabel("Massa muscular esquelética (kg)").fill("35,6");
    await form.getByLabel("Gordura visceral").fill("9");
    await form.getByLabel("Massa magra (kg)").fill("64,6");
    await form.getByRole("button", { name: "Salvar medição" }).click();
    await expect(page.getByText("Medição registrada.")).toBeVisible();

    await expect(metricCard(page, "body_fat_pct")).toContainText("21,4%");
    const fat = metricCard(page, "body_fat_pct").locator('[data-direction="down"]').first();
    await expect(fat).toContainText("−0,6 p.p. desde a 1ª");
    await expect(fat).toHaveAttribute("data-tone", "good");
    await expect(metricCard(page, "skeletal_muscle_kg").locator('[data-tone="good"]').first()).toContainText("+0,6 kg desde a 1ª");
    await expect(metricCard(page, "weight_kg")).toContainText("83,2 kg");
    await expect(page.getByTestId("measurement-item")).toHaveCount(2);
    expect(await countRows(user, "body_measurements")).toBe(2);

    // O peso do dia vem da medição (trigger) e aparece na Evolução com a origem.
    await page.getByRole("link", { name: "Evolução" }).first().click();
    await expect(page).toHaveURL(/\/evolucao$/);
    const trend = chart(page, "Tendência do peso");
    await trend.getByRole("button", { name: "Ver dados" }).click();
    const rows = trend.getByRole("table").locator("tbody tr");
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0)).toContainText("83,2 kg");
    await expect(rows.nth(0)).toContainText("Balança");
    // Peso da balança sai pela medição: sem lixeira na linha.
    await expect(rows.nth(0).getByRole("button")).toHaveCount(0);
  });

  test("valor fora da faixa mostra a mensagem e não grava", async ({ page }) => {
    await page.goto("/evolucao/composicao");
    await expect(page.getByTestId("composition-empty")).toContainText("Nenhuma medição ainda.");

    const form = await openNewMeasurement(page);
    await form.getByLabel(/^Peso \(kg\)/).fill("82");
    await form.getByLabel("Gordura corporal (%)").fill("85");
    await form.getByRole("button", { name: /Mais métricas/ }).click();
    await form.getByLabel("Idade metabólica (anos)").fill("30,5");
    await form.getByRole("button", { name: "Salvar medição" }).click();

    const alert = form.getByRole("alert");
    await expect(alert).toContainText("Gordura corporal entre 2 e 70 %.");
    await expect(alert).toContainText("Idade metabólica deve ser um número inteiro.");
    await expect(form.getByLabel("Gordura corporal (%)")).toHaveAttribute("aria-invalid", "true");
    expect(await countRows(user, "body_measurements")).toBe(0);

    // Corrigido, grava.
    await form.getByLabel("Gordura corporal (%)").fill("20");
    await form.getByLabel("Idade metabólica (anos)").fill("30");
    await form.getByRole("button", { name: "Salvar medição" }).click();
    await expect(page.getByText("Medição registrada.")).toBeVisible();
    await expect.poll(() => countRows(user, "body_measurements")).toBe(1);
  });

  test("detalhe com as 17 métricas, editar e excluir com confirmação", async ({ page }) => {
    await seedMeasurements(user, [
      { at: `${addDays(today, -20)} 07:00`, weight_kg: 84, body_fat_pct: 22, bmr_kcal: 1780, metabolic_age: 31 },
      { at: `${addDays(today, -5)} 07:30`, weight_kg: 83.5, body_fat_pct: 21.6, bmr_kcal: 1795, metabolic_age: 30 },
    ]);
    await page.goto("/evolucao/composicao");
    await page.getByTestId("measurement-item").first().click();

    const detail = page.getByRole("dialog", { name: "Medição", exact: true });
    await expect(detail.getByRole("definition")).toHaveCount(17);
    await expect(detail.locator('[data-metric="bmr_kcal"]')).toContainText("1.795 kcal");
    await expect(detail.locator('[data-metric="water_pct"]')).toContainText("não medido");

    await detail.getByRole("button", { name: "Editar" }).click();
    const form = page.getByRole("form", { name: "Editar medição" });
    await expect(form.getByLabel(/^Peso \(kg\)/)).toHaveValue("83,5");
    // Métrica secundária preenchida: "Mais métricas" já vem aberto.
    await expect(form.getByLabel("Metabolismo basal (kcal)")).toHaveValue("1795");
    await form.getByLabel(/^Peso \(kg\)/).fill("83,1");
    await form.getByRole("button", { name: "Salvar alterações" }).click();
    await expect(page.getByText("Medição atualizada.")).toBeVisible();
    await expect(page.getByTestId("measurement-item").first()).toContainText("83,1 kg");
    expect(await countRows(user, "body_measurements")).toBe(2);

    await page.getByTestId("measurement-item").first().click();
    await page.getByRole("dialog", { name: "Medição", exact: true }).getByRole("button", { name: "Excluir" }).click();
    const confirm = page.getByRole("dialog", { name: "Excluir medição?" });
    await confirm.getByRole("button", { name: "Cancelar" }).click();
    expect(await countRows(user, "body_measurements")).toBe(2);

    await page.getByRole("dialog", { name: "Medição", exact: true }).getByRole("button", { name: "Excluir" }).click();
    await page.getByRole("dialog", { name: "Excluir medição?" }).getByRole("button", { name: "Excluir medição" }).click();
    await expect(page.getByText("Medição excluída.")).toBeVisible();
    await expect(page.getByTestId("measurement-item")).toHaveCount(1);
    await expect.poll(() => countRows(user, "body_measurements")).toBe(1);
    await expect(metricCard(page, "weight_kg")).toContainText("84 kg");
  });

  test("gráficos: métrica, período, gordura × músculo e ver dados", async ({ page }) => {
    await seedMeasurements(user, [
      { at: `${addDays(today, -120)} 07:00`, weight_kg: 86, body_fat_pct: 24, fat_mass_kg: 20.6, skeletal_muscle_kg: 34.5 },
      { at: `${addDays(today, -50)} 07:00`, weight_kg: 85, body_fat_pct: 23, fat_mass_kg: 19.5, skeletal_muscle_kg: 35 },
      { at: `${addDays(today, -15)} 07:00`, weight_kg: 84, body_fat_pct: 22, fat_mass_kg: 18.5, skeletal_muscle_kg: 35.4 },
      { at: `${addDays(today, -2)} 07:00`, weight_kg: 83.6, body_fat_pct: 21.5 },
    ]);
    await page.goto("/evolucao/composicao");

    const dots = (title: string) => chart(page, title).locator(".recharts-line-dots").first().locator("circle");
    const period = page.getByRole("group", { name: "Período" });
    // Padrão: gordura corporal nos últimos 3 meses.
    await expect(page.getByRole("group", { name: "Métrica" }).getByRole("button", { name: "Gordura" })).toHaveAttribute("aria-pressed", "true");
    await expect(dots("Gordura corporal")).toHaveCount(3);
    await period.getByRole("button", { name: "Tudo" }).click();
    await expect(dots("Gordura corporal")).toHaveCount(4);
    await period.getByRole("button", { name: "1 mês" }).click();
    await expect(dots("Gordura corporal")).toHaveCount(2);

    await period.getByRole("button", { name: "Tudo" }).click();
    await page.getByRole("group", { name: "Métrica" }).getByRole("button", { name: "Peso" }).click();
    await chart(page, "Peso").getByRole("button", { name: "Ver dados" }).click();
    await expect(chart(page, "Peso").getByRole("table").locator("tbody tr")).toHaveCount(4);
    await expect(chart(page, "Peso").getByRole("table").locator("tbody tr").first()).toContainText("83,6 kg");

    // Gordura × músculo: só as 3 medições com as duas em kg.
    const pair = chart(page, "Gordura × músculo");
    await expect(pair.getByRole("list", { name: "Legenda" })).toContainText("Músculo esquelético");
    await pair.getByRole("button", { name: "Ver dados" }).click();
    const rows = pair.getByRole("table").locator("tbody tr");
    await expect(rows).toHaveCount(3);
    await expect(rows.first()).toContainText("18,5 kg");
    await expect(rows.first()).toContainText("35,4 kg");

    // 375 px sem rolagem horizontal.
    await page.setViewportSize({ width: 375, height: 800 });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
