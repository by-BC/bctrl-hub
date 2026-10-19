import { expect, test, type Page } from "@playwright/test";
import { dayInSaoPaulo } from "../../src/lib/domain/day";
import { addDays, filterByRange, type Range } from "../../src/lib/domain/stats";
import {
  createDisposableUser,
  deleteDisposableUser,
  seedExercise,
  seedTrainingPlan,
  seedWorkout,
  type DisposableUser,
} from "./disposable-user";
import { loginAndWaitForHome } from "./fixtures";

const chart = (page: Page, title: string) => page.getByRole("figure", { name: title });
const dots = (page: Page, title: string) => chart(page, title).locator(".recharts-line-dots circle");

test.describe("evolução e peso corporal", () => {
  let user: DisposableUser;
  let supino: string;
  let semTreino: string;
  // Datas relativas a hoje: os períodos (1 mês / 3 meses / tudo) continuam válidos em qualquer dia.
  const today = dayInSaoPaulo(new Date());
  const sessionDays: string[] = [];

  test.beforeAll(async () => {
    user = await createDisposableUser("e2e-evolucao");
    const plan = await seedTrainingPlan(user); // supino: 40 × 10 e 40 × 8 em 2026-10-12
    supino = plan.exercises.supino;
    const extra = [
      { day: addDays(today, -200), sets: [[45, 8]] as const },
      { day: addDays(today, -60), sets: [[42.5, 10]] as const },
      { day: addDays(today, -2), sets: [[50, 5, ["weight"]]] as const },
    ];
    for (const w of extra) await seedWorkout(user, { day: w.day, sets: [[supino, w.sets]] });
    sessionDays.push("2026-10-12", ...extra.map((w) => w.day));

    semTreino = await seedExercise(user, "Rosca E2E");
  });
  test.afterAll(async () => {
    await deleteDisposableUser(user);
  });
  test.beforeEach(async ({ page }) => {
    await loginAndWaitForHome(page, user.email, user.password);
  });

  const countIn = (range: Range) => filterByRange(sessionDays.map((day) => ({ day })), range, today).length;

  test("registrar o peso mostra o ponto; o mesmo dia atualiza em vez de duplicar", async ({ page }) => {
    await page.goto("/evolucao");
    const section = page.getByRole("region", { name: "Peso corporal" });
    await expect(section.getByText("Nenhum peso registrado ainda.", { exact: false })).toBeVisible();

    const form = section.getByRole("form", { name: "Registrar peso" });
    await expect(form.getByLabel("Dia")).toHaveValue(today);
    await form.getByLabel("Peso (kg)").fill("82,4");
    await form.getByRole("button", { name: "Registrar peso" }).click();
    await expect(page.getByText(/Peso registrado: 82,4 kg/)).toBeVisible();

    const trend = chart(page, "Tendência do peso");
    await expect(trend).toBeVisible();
    await expect(dots(page, "Tendência do peso")).toHaveCount(2); // peso do dia + média, no mesmo dia

    // Mesmo dia de novo: substitui.
    await form.getByLabel("Peso (kg)").fill("81,9");
    await form.getByRole("button", { name: "Registrar peso" }).click();
    await expect(page.getByText(/Peso atualizado: 81,9 kg/)).toBeVisible();

    // Outro dia: segundo ponto.
    await form.getByLabel("Dia").fill(addDays(today, -3));
    await form.getByLabel("Peso (kg)").fill("83");
    await form.getByRole("button", { name: "Registrar peso" }).click();
    await expect(dots(page, "Tendência do peso")).toHaveCount(4);

    await trend.getByRole("button", { name: "Ver dados" }).click();
    const rows = trend.getByRole("table").locator("tbody tr");
    await expect(rows).toHaveCount(2);
    // Mais recente primeiro; média de 7 dias = (83 + 81,9) / 2.
    await expect(rows.nth(0)).toContainText("81,9 kg");
    await expect(rows.nth(0)).toContainText("82,45 kg");
    await expect(rows.nth(1)).toContainText("83 kg");

    // Persistiu no banco: recarregar mantém os 2 registros.
    await page.reload();
    await chart(page, "Tendência do peso").getByRole("button", { name: "Ver dados" }).click();
    await expect(chart(page, "Tendência do peso").getByRole("table").locator("tbody tr")).toHaveCount(2);
  });

  test("abrir um exercício pelo Treino, trocar métrica e período e ver os dados", async ({ page }) => {
    // No celular a Evolução não está na barra: o acesso é pelo Treino.
    await page.goto("/treino");
    await page.getByRole("link", { name: /Evolução/ }).first().click();
    await expect(page).toHaveURL(/\/evolucao$/);

    const item = page.getByTestId("progress-item").filter({ hasText: "Supino E2E" });
    await expect(item).toContainText("50 kg");
    await page.getByRole("searchbox", { name: "Buscar exercício" }).fill("supino");
    await expect(page.getByTestId("progress-item")).toHaveCount(1);
    await item.click();

    await expect(page).toHaveURL(new RegExp(`/evolucao/${supino}$`));
    await expect(page.getByRole("heading", { level: 1, name: "Supino E2E" })).toBeVisible();
    await expect(page.getByTestId("exercise-bests")).toContainText("50 kg");

    // Padrão: melhor carga nos últimos 3 meses.
    const metric = page.getByRole("group", { name: "Métrica" });
    const period = page.getByRole("group", { name: "Período" });
    await expect(metric.getByRole("button", { name: "Carga" })).toHaveAttribute("aria-pressed", "true");
    await expect(dots(page, "Melhor carga")).toHaveCount(countIn("3m"));

    await period.getByRole("button", { name: "Tudo" }).click();
    await expect(period.getByRole("button", { name: "Tudo" })).toHaveAttribute("aria-pressed", "true");
    await expect(dots(page, "Melhor carga")).toHaveCount(4);

    await period.getByRole("button", { name: "1 mês" }).click();
    await expect(dots(page, "Melhor carga")).toHaveCount(countIn("1m"));

    await period.getByRole("button", { name: "Tudo" }).click();
    await metric.getByRole("button", { name: "1RM" }).click();
    await expect(chart(page, "1RM estimado")).toBeVisible();
    await metric.getByRole("button", { name: "Volume" }).click();
    const volume = chart(page, "Volume");
    await expect(volume).toBeVisible();
    await expect(dots(page, "Volume")).toHaveCount(4);

    // "Ver dados": tabela com uma linha por sessão, a mais recente primeiro.
    await volume.getByRole("button", { name: "Ver dados" }).click();
    const rows = volume.getByRole("table").locator("tbody tr");
    await expect(rows).toHaveCount(4);
    // 50 × 5 → carga 50, 1RM 58,33, volume 250.
    await expect(rows.nth(0)).toContainText("50 kg");
    await expect(rows.nth(0)).toContainText("58,33 kg");
    await expect(rows.nth(0)).toContainText("250 kg");
    await volume.getByRole("button", { name: "Ocultar dados" }).click();
    await expect(volume.getByRole("table")).toBeHidden();

    // Recordes e histórico de séries.
    await expect(page.getByTestId("pr-list")).toContainText("50 kg × 5");
    await expect(page.getByTestId("pr-list").getByTestId("pr-badge")).toHaveText("PR · carga");
    await expect(page.getByTestId("exercise-session")).toHaveCount(4);
    await expect(page.getByTestId("exercise-session").first()).toContainText("50 kg × 5");
  });

  test("exercício sem treinos mostra o estado vazio", async ({ page }) => {
    await page.goto(`/evolucao/${semTreino}`);
    await expect(page.getByRole("heading", { level: 1, name: "Rosca E2E" })).toBeVisible();
    await expect(page.getByTestId("exercise-empty")).toContainText("Nenhum treino com este exercício ainda.");
  });
});
