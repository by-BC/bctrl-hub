import { expect, test, type Page } from "@playwright/test";
import { formatDateBR } from "../../src/features/composition/goals-view";
import { projectGoal } from "../../src/lib/domain/composition";
import { dayInSaoPaulo } from "../../src/lib/domain/day";
import { addDays } from "../../src/lib/domain/stats";
import {
  compositionGoalRows,
  createDisposableUser,
  deleteDisposableUser,
  seedMealPlan,
  seedMeasurements,
  seedProfile,
  type DisposableUser,
} from "./disposable-user";
import { loginAndWaitForHome } from "./fixtures";

/**
 * v3 (task 4.0): metas de composição (criar, progresso, projeção, editar, arquivar e conclusão ao
 * salvar a medição) e a fonte da TMB nas metas nutricionais (/perfil/dados, Comida e Hoje).
 * Usuário descartável, dados fictícios, sem offline.
 */

test.describe.configure({ timeout: 90_000 });

const today = dayInSaoPaulo(new Date());
const SYNC = { timeout: 15_000 };
const days = [addDays(today, -21), addDays(today, -11), addDays(today, -1)];
/** Gordura caindo 1 p.p. a cada 10 dias: 22 → 21 → 20. */
const falling = [22, 21, 20];

const goalCard = (page: Page, metric: string) => page.getByTestId("composition-goal").and(page.locator(`[data-metric="${metric}"]`));

async function seedFalling(user: DisposableUser, extra: Record<string, number> = {}) {
  await seedMeasurements(
    user,
    days.map((d, i) => ({ at: `${d} 07:00`, weight_kg: 82 - i, body_fat_pct: falling[i], ...extra })),
  );
}

async function createFatGoal(page: Page, target: string, targetDate?: string) {
  const goals = page.getByTestId("composition-goals");
  await expect(goals.getByTestId("composition-goals-empty")).toBeVisible();
  await goals.getByRole("button", { name: "Nova meta" }).click();
  const form = page.getByRole("form", { name: "Nova meta" });
  await form.getByLabel("Métrica").selectOption("body_fat_pct");
  await expect(form.getByTestId("goal-start")).toHaveText(`Partida: 20% em ${formatDateBR(days[2])}`);
  await form.getByLabel("Alvo (%)").fill(target);
  if (targetDate) await form.getByLabel("Data-alvo (opcional)").fill(targetDate);
  await form.getByRole("button", { name: "Salvar meta" }).click();
  await expect(page.getByText("Meta salva.")).toBeVisible(SYNC);
}

test.describe("metas de composição", () => {
  let user: DisposableUser;

  test.afterEach(async () => {
    await deleteDisposableUser(user);
  });

  test("cria a meta com medições semeadas, vê progresso e projeção, edita e arquiva", async ({ page }) => {
    user = await createDisposableUser("e2e-metas-comp");
    await seedFalling(user);
    await loginAndWaitForHome(page, user.email, user.password);
    await page.goto("/evolucao/composicao");

    const targetDate = addDays(today, 60);
    await createFatGoal(page, "18", targetDate);

    const card = goalCard(page, "body_fat_pct");
    await expect(card.getByRole("heading", { name: "Gordura corporal" })).toBeVisible();
    // Partida = atual (a última medição): 0% concluído.
    await expect(card.getByTestId("goal-progress")).toHaveText("0% concluído");
    await expect(card).toContainText(`até ${formatDateBR(targetDate)}`);
    const expected = projectGoal(
      days.map((day, i) => ({ day, value: falling[i] })),
      18,
      20,
    ) as { date: string };
    await expect(card.getByTestId("goal-projection")).toHaveText(`Deve chegar em ${formatDateBR(expected.date)}`);

    expect(await compositionGoalRows(user)).toEqual([
      {
        metric: "body_fat_pct",
        target: 18,
        target_date: targetDate,
        start_value: 20,
        start_day: days[2],
        achieved_on: null,
        archived_at: null,
      },
    ]);

    // Nova medição depois da partida: o progresso avança (20 → 19 de 20 → 18 = 50%).
    await seedMeasurements(user, [{ at: `${today} 06:00`, weight_kg: 79, body_fat_pct: 19 }]);
    await page.reload();
    await expect(card.getByTestId("goal-progress")).toHaveText("50% concluído");

    // Editar o alvo: tendência contrária não há; alvo já atingido = sem projeção com o motivo.
    await card.getByRole("button", { name: "Editar meta: Gordura corporal" }).click();
    const edit = page.getByRole("form", { name: "Editar meta" });
    await expect(edit.getByLabel("Alvo (%)")).toHaveValue("18");
    await edit.getByLabel("Alvo (%)").fill("19");
    await edit.getByRole("button", { name: "Salvar alterações" }).click();
    await expect(page.getByText("Meta atualizada.")).toBeVisible(SYNC);
    await expect(card.getByTestId("goal-progress")).toHaveText("100% concluído");
    await expect(card.getByTestId("goal-projection")).toHaveText("Sem projeção: a meta já foi atingida");
    await expect(card.getByTestId("goal-achieved")).toHaveText(`Meta atingida em ${formatDateBR(today)}`);

    // Arquivar (com confirmação): a métrica fica livre de novo.
    await card.getByRole("button", { name: "Arquivar meta: Gordura corporal" }).click();
    await page.getByRole("dialog", { name: "Arquivar meta?" }).getByRole("button", { name: "Arquivar meta" }).click();
    await expect(page.getByText("Meta arquivada.")).toBeVisible(SYNC);
    await expect(page.getByTestId("composition-goals-empty")).toBeVisible();
    await expect.poll(async () => (await compositionGoalRows(user))[0]?.archived_at ?? null, SYNC).not.toBeNull();
  });

  test("a medição que atinge o alvo marca a meta como atingida (uma vez)", async ({ page }) => {
    user = await createDisposableUser("e2e-metas-atinge");
    await seedFalling(user);
    await loginAndWaitForHome(page, user.email, user.password);
    await page.goto("/evolucao/composicao");
    await createFatGoal(page, "19,5");
    await expect(goalCard(page, "body_fat_pct").getByTestId("goal-achieved")).toHaveCount(0);

    await page.getByRole("button", { name: "Nova medição" }).click();
    const form = page.getByRole("form", { name: "Nova medição" });
    await form.getByLabel(/^Peso \(kg\)/).fill("79,5");
    await form.getByLabel("Gordura corporal (%)").fill("19,4");
    await form.getByRole("button", { name: "Salvar medição" }).click();
    await expect(page.getByText("Meta de composição atingida!")).toBeVisible(SYNC);

    const card = goalCard(page, "body_fat_pct");
    await expect(card.getByTestId("goal-achieved")).toHaveText(`Meta atingida em ${formatDateBR(today)}`, SYNC);
    await expect(card.getByTestId("goal-progress")).toHaveText("100% concluído");
    await expect.poll(async () => (await compositionGoalRows(user))[0]?.achieved_on ?? null, SYNC).toBe(today);
  });
});

test.describe("fonte da TMB nas metas nutricionais", () => {
  let user: DisposableUser;

  test.afterEach(async () => {
    await deleteDisposableUser(user);
  });

  /*
   * Perfil fictício: homem, 30 anos, 180 cm, 80 kg, moderado, manter, 2 g/kg.
   * Fórmula: TMB 1.780 → 2.759 kcal · P 160 · C 386 · G 64.
   * Balança (TMB 1.900 de ontem): 2.945 kcal · P 160 · C 429 · G 65.
   * Proteína por massa magra (65 kg × 2,5): 163 g.
   */
  test("mostra a TMB da balança, alterna para a fórmula e as metas de Comida e Hoje acompanham", async ({ page }) => {
    user = await createDisposableUser("e2e-metas-tmb");
    await seedMealPlan(user);
    await seedProfile(user, { birth_date: `${Number(today.slice(0, 4)) - 30}-01-01` });
    await seedMeasurements(user, [{ at: `${days[2]} 07:00`, weight_kg: 80, bmr_kcal: 1900, lean_mass_kg: 65 }]);
    await loginAndWaitForHome(page, user.email, user.password);

    await page.goto("/perfil/dados");
    const source = page.getByTestId("bmr-source");
    await expect(source).toContainText(`TMB: balança (${formatDateBR(days[2]).slice(0, 5)})`);
    await expect(page.getByRole("group", { name: "Fonte da TMB" }).getByRole("button", { name: "Automática" })).toHaveAttribute("aria-pressed", "true");
    const breakdown = page.getByTestId("goal-breakdown");
    await expect(breakdown).toContainText("1.900 kcal medidos pela balança");
    await expect(page.getByTestId("goals-rest")).toHaveText("Meta: 2.945 kcal · P 160 g · C 429 g · G 65 g");

    // Fórmula: volta ao cálculo da v2.
    await page.getByRole("group", { name: "Fonte da TMB" }).getByRole("button", { name: "Fórmula" }).click();
    await expect(source).toContainText("TMB: fórmula");
    await expect(source).toContainText("Fonte escolhida: a fórmula de Mifflin-St Jeor.");
    await expect(breakdown).toContainText("10 × 80 + 6,25 × 180 − 5 × 30 + 5 = 1.780 kcal");
    await expect(page.getByTestId("goals-rest")).toHaveText("Meta: 2.759 kcal · P 160 g · C 386 g · G 64 g");

    // Proteína pela massa magra (padrão 2,5 g/kg).
    await page.getByRole("group", { name: "Base da proteína" }).getByRole("button", { name: "Massa magra" }).click();
    await expect(page.getByLabel("Proteína (g por kg de massa magra)")).toHaveValue("2,5");
    await expect(breakdown).toContainText("2,5 g/kg × 65 kg = 163 g");
    await expect(page.getByTestId("goals-rest")).toHaveText("Meta: 2.759 kcal · P 163 g · C 383 g · G 64 g");

    await page.getByRole("button", { name: "Salvar dados" }).click();
    await expect(page.getByText("Dados salvos.")).toBeVisible(SYNC);
    await page.reload();
    await expect(page.getByRole("group", { name: "Fonte da TMB" }).getByRole("button", { name: "Fórmula" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("goals-rest")).toHaveText("Meta: 2.759 kcal · P 163 g · C 383 g · G 64 g");

    const kcalRow = page.getByTestId("day-nutrition").getByTestId("nutrition-kcal");
    await page.goto("/comida");
    await expect(kcalRow).toContainText("/ 2.759 kcal");

    // De volta à automática: Comida e Hoje usam a TMB da balança.
    await page.goto("/perfil/dados");
    await page.getByRole("group", { name: "Fonte da TMB" }).getByRole("button", { name: "Automática" }).click();
    await page.getByRole("group", { name: "Base da proteína" }).getByRole("button", { name: "Peso" }).click();
    await page.getByRole("button", { name: "Salvar dados" }).click();
    await expect(page.getByText("Dados salvos.")).toBeVisible(SYNC);
    await page.goto("/comida");
    await expect(kcalRow).toContainText("/ 2.945 kcal");
    await page.goto("/");
    await expect(kcalRow).toContainText("/ 2.945 kcal");
  });

  test("sem medição, a TMB é a da fórmula e explica o motivo", async ({ page }) => {
    user = await createDisposableUser("e2e-metas-sem-medicao");
    await seedProfile(user, { birth_date: `${Number(today.slice(0, 4)) - 30}-01-01` });
    await loginAndWaitForHome(page, user.email, user.password);
    await page.goto("/perfil/dados");
    await expect(page.getByTestId("bmr-source")).toContainText("TMB: fórmula");
    await expect(page.getByTestId("bmr-source")).toContainText("Sem medição da balança com metabolismo basal");
    await page.getByRole("group", { name: "Fonte da TMB" }).getByRole("button", { name: "Balança" }).click();
    await expect(page.getByTestId("bmr-source")).toContainText("Você escolheu a balança, mas não há medição");
  });
});
