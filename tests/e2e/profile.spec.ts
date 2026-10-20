import { expect, test, type Page } from "@playwright/test";
import { dayInSaoPaulo } from "../../src/lib/domain/day";
import { monthLabel } from "../../src/lib/domain/month-view";
import { addDays } from "../../src/lib/domain/stats";
import { addMonths, monthStart } from "../../src/lib/domain/week";
import {
  createDisposableUser,
  deleteDisposableUser,
  seedDoneTask,
  seedExercise,
  seedMealLogs,
  seedMealPlan,
  seedWorkout,
  type DisposableUser,
} from "./disposable-user";
import { loginAndWaitForHome } from "./fixtures";

/**
 * Task 7.0 v2: tela de Perfil. Usuário descartável sem perfil, com dias semeados de pontuação
 * conhecida (via `daily_scores`):
 * - hoje − 3: treino com PR de carga → nível 1;
 * - hoje − 2: treino + tarefa concluída → nível 2;
 * - hoje − 1: treino + tarefa + as 4 refeições do dia de treino → nível 3;
 * - dia 10 do mês passado: 1 treino (para a troca de mês).
 */

let user: DisposableUser;
const today = dayInSaoPaulo(new Date());
const day = { l1: addDays(today, -3), l2: addDays(today, -2), l3: addDays(today, -1) };
const prevMonth = addMonths(today, -1);
const prevDay = `${prevMonth.slice(0, 7)}-10`;
const workoutDays = [day.l1, day.l2, day.l3, prevDay];
const workoutsIn = (month: string) => workoutDays.filter((d) => monthStart(d) === month).length;

const heatmap = (page: Page) => page.getByTestId("control-heatmap");
const block = (page: Page, date: string) => heatmap(page).locator(`rect[data-date="${date}"]`);

// O seed (≈ 20 inserts) mais login e navegação passam dos 30 s padrão numa máquina fria; se o
// tempo estoura no meio do beforeEach, o afterEach apaga o usuário e o seed quebra por FK.
test.describe.configure({ timeout: 90_000 });

test.beforeEach(async () => {
  user = await createDisposableUser("e2e-perfil");
  const [supino, meals] = await Promise.all([seedExercise(user, "Supino Perfil E2E"), seedMealPlan(user)]);
  await Promise.all([
    seedWorkout(user, { day: day.l1, sets: [[supino, [[60, 8, ["weight"]]]]] }),
    seedWorkout(user, { day: day.l2, sets: [[supino, [[50, 10]]]] }),
    seedWorkout(user, { day: day.l3, sets: [[supino, [[50, 10]]]] }),
    seedWorkout(user, { day: prevDay, sets: [[supino, [[40, 10]]]] }),
    seedDoneTask(user, day.l2),
    seedDoneTask(user, day.l3),
    seedMealLogs(user, day.l3, [meals.cafe, meals.almoco, meals.pos, meals.jantar]),
  ]);
});

test.afterEach(async () => {
  await deleteDisposableUser(user);
});

test("heatmap: níveis batem com a pontuação, futuro vazio e tempo até aparecer", async ({ page, isMobile }) => {
  await loginAndWaitForHome(page, user.email, user.password);

  // 1ª visita compila a rota no dev; a medida vale na 2ª (carga completa da página).
  await page.goto("/perfil");
  await expect(block(page, today)).toBeVisible();
  await page.goto("/perfil");
  await page.waitForFunction(() => document.querySelector('[data-testid="control-heatmap"] rect[data-level]') !== null);
  const sinceNavigation = await page.evaluate(() => Math.round(performance.now()));

  // Navegação pelo app (clique no atalho do Perfil a partir de Hoje).
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Hoje" })).toBeVisible();
  const start = Date.now();
  const link = isMobile
    ? page.getByRole("banner").getByRole("link", { name: "Perfil" })
    : page.getByRole("navigation", { name: "Navegação principal" }).getByRole("link", { name: "Perfil" });
  await link.click();
  await expect(block(page, today)).toBeVisible();
  const inApp = Date.now() - start;
  test.info().annotations.push({ type: "tempo até o heatmap", description: `carga ${sinceNavigation} ms · no app ${inApp} ms` });
  console.log(`[perfil] tempo até o heatmap: carga completa ${sinceNavigation} ms, navegação no app ${inApp} ms`);
  expect(sinceNavigation).toBeLessThan(5_000);

  await expect(page.getByRole("heading", { level: 1, name: "Perfil" })).toBeVisible();
  await expect(block(page, day.l1)).toHaveAttribute("data-level", "1");
  await expect(block(page, day.l2)).toHaveAttribute("data-level", "2");
  await expect(block(page, day.l3)).toHaveAttribute("data-level", "3");
  await expect(block(page, today)).toHaveAttribute("data-level", "0");
  await expect(block(page, day.l3)).toHaveAttribute("aria-label", /3 de 4 pontos \(Treino ou cardio, Dieta no plano \(≥ 80%\), Tarefa concluída\)/);
  // Dias futuros não existem no calendário.
  await expect(block(page, addDays(today, 1))).toHaveCount(0);
  // 12 meses: do 1º dia de 11 meses atrás até hoje.
  await expect(block(page, addMonths(today, -11))).toHaveCount(1);
  await expect(block(page, addDays(addMonths(today, -11), -1))).toHaveCount(0);

  // Alternativa textual: resumo e tabela por mês.
  await expect(page.getByTestId("heatmap-month-text")).toHaveText(/^\d+ de \d+ dias? no controle$/);
  await page.getByRole("button", { name: "Ver tabela por mês" }).click();
  await expect(page.getByRole("table", { name: /Dias no controle por mês/ })).toBeVisible();

  // Sem rolagem horizontal da página; no celular o bloco rola sozinho e começa em hoje.
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  if (isMobile) {
    const scroll = await heatmap(page)
      .locator(".react-activity-calendar__scroll-container")
      .evaluate((el) => ({ left: el.scrollLeft, max: el.scrollWidth - el.clientWidth }));
    expect(scroll.max).toBeGreaterThan(0);
    expect(scroll.left).toBeGreaterThanOrEqual(scroll.max - 1);
  }
});

test("tooltip por toque ou mouse e teclado pelas setas", async ({ page, isMobile }) => {
  await loginAndWaitForHome(page, user.email, user.password);
  await page.goto("/perfil");
  await expect(block(page, day.l2)).toBeVisible();

  await block(page, day.l2).click();
  const tip = page.getByRole("tooltip");
  await expect(tip).toBeVisible();
  await expect(tip).toContainText("2 de 4 pontos");
  await expect(tip).toContainText("Treino ou cardio");
  await expect(tip).toContainText("Tarefa concluída");

  if (!isMobile) {
    // Setas: ← volta uma semana, ↓ avança um dia (sem passar de hoje).
    await expect(block(page, day.l2)).toBeFocused();
    await page.keyboard.press("ArrowLeft");
    await expect(block(page, addDays(day.l2, -7))).toBeFocused();
    await expect(block(page, addDays(day.l2, -7))).toHaveAttribute("tabindex", "0");
    await page.keyboard.press("End");
    await expect(block(page, today)).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(block(page, today)).toBeFocused();
    await expect(page.getByRole("tooltip")).toContainText("0 de 4 pontos");
  }
});

test("resumo: troca de mês sem passar do atual, recordes e conquistas", async ({ page }) => {
  await loginAndWaitForHome(page, user.email, user.password);
  await page.goto("/perfil");

  const current = monthStart(today);
  const month = page.getByTestId("summary-month");
  await expect(month).toContainText(monthLabel(current));
  const workouts = page.getByTestId("stat-workouts").getByTestId("stat-value");
  await expect(workouts).toHaveText(String(workoutsIn(current)));
  await expect(page.getByRole("button", { name: "Próximo mês" })).toBeDisabled();
  // Sem perfil: a meta pede os dados, com link.
  await expect(page.getByRole("link", { name: "Defina seus dados para ver metas", exact: true })).toHaveAttribute("href", "/perfil/dados");

  // O PR de carga aparece nos recordes do mês em que foi batido.
  if (monthStart(day.l1) !== current) await page.getByRole("button", { name: "Mês anterior" }).click();
  const records = page.getByTestId("month-records");
  await expect(records).toContainText("Supino Perfil E2E");
  await expect(records).toContainText("Carga");
  await expect(records).toContainText("60 kg");

  // Mês anterior ao atual.
  if (monthStart(day.l1) === current) await page.getByRole("button", { name: "Mês anterior" }).click();
  await expect(month).toContainText(monthLabel(prevMonth));
  await expect(workouts).toHaveText(String(workoutsIn(prevMonth)));
  await expect(page.getByRole("button", { name: "Próximo mês" })).toBeEnabled();
  // Mês com refeições previstas mas sem nenhum registro: "sem registros", nunca 0%.
  const prevHasMeals = monthStart(day.l3) === prevMonth;
  if (!prevHasMeals) await expect(page.getByTestId("stat-adherence")).toContainText("Sem registros");

  await page.getByRole("button", { name: "Próximo mês" }).click();
  await expect(month).toContainText(monthLabel(current));
  await expect(page.getByRole("button", { name: "Próximo mês" })).toBeDisabled();

  // Conquistas: o 1º recorde desbloqueado com data; 100 treinos bloqueada com progresso.
  const firstPr = page.getByTestId("achievement-first_pr");
  await expect(firstPr).toHaveAttribute("data-state", "unlocked");
  await expect(firstPr).toContainText("Desbloqueada em");
  const hundred = page.getByTestId("achievement-workouts_100");
  await expect(hundred).toHaveAttribute("data-state", "locked");
  await expect(hundred).toContainText("Bloqueada");
  await expect(hundred.getByRole("progressbar")).toHaveAttribute("aria-valuetext", "4 de 100 treinos");
});

test("atalhos do Perfil no shell e para os dados", async ({ page, isMobile }) => {
  await loginAndWaitForHome(page, user.email, user.password);
  if (isMobile) {
    await page.getByRole("banner").getByRole("link", { name: "Perfil" }).click();
    // A barra inferior continua com as 5 seções.
    const bottom = page.getByRole("navigation", { name: "Navegação principal" }).filter({ visible: true });
    await expect(bottom.getByRole("link")).toHaveCount(5);
  } else {
    const side = page.getByRole("navigation", { name: "Navegação principal" }).filter({ visible: true });
    await side.getByRole("link", { name: "Perfil" }).click();
    await expect(side.getByRole("link", { name: "Perfil" })).toHaveAttribute("aria-current", "page");
  }
  await expect(page.getByRole("heading", { level: 1, name: "Perfil" })).toBeVisible();
  await page.getByRole("link", { name: /Dados e metas/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Dados e metas" })).toBeVisible();
});
