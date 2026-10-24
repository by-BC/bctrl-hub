import { readFile } from "node:fs/promises";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { dayInSaoPaulo } from "../../src/lib/domain/day";
import { monthName } from "../../src/features/profile/domain/month-view";
import { addMonths, monthStart } from "../../src/lib/domain/week";
import {
  createDisposableUser,
  deleteDisposableUser,
  seedDoneTask,
  seedExercise,
  seedMealLogs,
  seedMealPlan,
  seedMeasurements,
  seedWorkout,
  type DisposableUser,
} from "./disposable-user";
import { loginAndWaitForHome } from "./fixtures";

/**
 * Task 8.0 v2 (RF17): card do mês no Story Studio. Usuário descartável com:
 * - hoje: treino com PR de carga + tarefa concluída + as 4 refeições → 3 pontos (no controle) e
 *   a conquista "Primeiro recorde" desbloqueada neste mês;
 * - dia 10 do mês passado: 1 treino e nenhuma refeição registrada ("sem registros").
 */

let user: DisposableUser;
const today = dayInSaoPaulo(new Date());
const current = monthStart(today);
const previous = addMonths(today, -1);

/** Largura × altura lidas do cabeçalho IHDR do PNG. */
async function pngSize(file: string) {
  const buf = await readFile(file);
  expect(buf.subarray(1, 4).toString("ascii")).toBe("PNG");
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

/**
 * Todo texto do quadro fica entre as faixas de 250 px do topo e da base (coordenadas do
 * quadro em tamanho real, desfazendo a escala da prévia). Devolve o que escapar.
 */
function outsideSafeArea(page: Page) {
  return page.locator("[data-story-frame]").evaluate((frame) => {
    const box = frame.getBoundingClientRect();
    const scale = box.width / 1080;
    const out: string[] = [];
    const walker = document.createTreeWalker(frame, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (!node.textContent?.trim()) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      const r = range.getBoundingClientRect();
      const top = (r.top - box.top) / scale;
      const bottom = (r.bottom - box.top) / scale;
      if (top < 250 || bottom > 1670) out.push(`${node.textContent.trim()} (${Math.round(top)}–${Math.round(bottom)})`);
    }
    return out;
  });
}

test.describe.configure({ timeout: 90_000 });

test.beforeAll(async () => {
  user = await createDisposableUser("e2e-card-mes");
  const [supino, meals] = await Promise.all([seedExercise(user, "Supino Card E2E"), seedMealPlan(user)]);
  await Promise.all([
    seedWorkout(user, { day: today, sets: [[supino, [[60, 8, ["weight"]], [50, 10]]]] }),
    seedWorkout(user, { day: `${previous.slice(0, 7)}-10`, sets: [[supino, [[40, 10]]]] }),
    seedDoneTask(user, today),
    seedMealLogs(user, today, [meals.cafe, meals.almoco, meals.pos, meals.jantar]),
    seedMeasurements(user, [
      { at: `${previous.slice(0, 7)}-10 07:00`, weight_kg: 81, body_fat_pct: 21, skeletal_muscle_kg: 34.8 },
      { at: `${current} 07:00`, weight_kg: 80, body_fat_pct: 20, skeletal_muscle_kg: 35 },
      { at: `${today} 08:00`, weight_kg: 79, body_fat_pct: 19, skeletal_muscle_kg: 35.6 },
    ]),
  ]);
});

test.afterAll(async () => {
  await deleteDisposableUser(user);
});

test.beforeEach(async ({ page }) => {
  // Força o caminho de download (sem Web Share) para validar o arquivo.
  await page.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, "canShare", { value: undefined, configurable: true });
  });
  await loginAndWaitForHome(page, user.email, user.password);
});

test("atalho do Perfil abre o card do mês, com os números e o PNG em 1080×1920", async ({ page }) => {
  await page.goto("/perfil");
  const composition = page.getByRole("list", { name: "Variações de composição no mês" });
  await expect(composition.getByTestId("composition-stat-weight")).toContainText("−1 kg");
  await expect(composition.getByTestId("composition-stat-fat")).toContainText("−1 p.p.");
  await expect(composition.getByTestId("composition-stat-muscle")).toContainText("+0,6 kg");

  await page.getByRole("link", { name: "Nova medição" }).click();
  await expect(page).toHaveURL(/\/evolucao\/composicao\?nova=1$/);
  await expect(page.getByRole("form", { name: "Nova medição" })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.goto("/perfil");
  await page.getByRole("link", { name: "Compartilhar mês" }).click();
  await expect(page).toHaveURL(new RegExp(`/perfil/mes/${current.slice(0, 7)}/story$`));
  await expect(page.getByRole("heading", { level: 1, name: "Compartilhar mês" })).toBeVisible();

  const card = page.getByTestId("month-card-preview");
  await expect(card.getByTestId("month-card-title")).toContainText(monthName(current));
  await expect(card.getByTestId("month-card-title")).toContainText(current.slice(0, 4));

  // Calendário: hoje com 3 pontos; dias depois de hoje sem nível (só contorno).
  const heatmap = card.getByTestId("month-card-heatmap");
  await expect(heatmap.locator(`[data-date="${today}"]`)).toHaveAttribute("data-level", "3");
  const future = await heatmap.locator('[data-level="future"]').count();
  const daysLeft = Number(new Date(Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)), 0)).getUTCDate()) - Number(today.slice(8));
  expect(future).toBe(daysLeft);

  await expect(card.getByTestId("month-card-control").locator("p").nth(1)).toHaveText("1");
  const stats = card.locator("dl");
  await expect(stats.getByText("Treinos").locator("..")).toContainText("1");
  await expect(stats.getByText("Volume · kg").locator("..")).toContainText("980"); // 480 + 500
  await expect(stats.getByText("Recordes").locator("..")).toContainText("1");
  await expect(card.getByTestId("month-card-adherence")).toContainText("%");
  await expect(card.getByTestId("month-card-composition")).toContainText("Gordura −1 p.p.");
  await expect(card.getByTestId("month-card-composition")).toContainText("Músculo +0,6 kg");
  await expect(card.getByTestId("month-card-achievements")).toContainText("Primeiro recorde");

  expect(await outsideSafeArea(page)).toEqual([]);

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Baixar PNG" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe(`bctrl-mes-${current.slice(0, 7)}.png`);
  expect(await pngSize(await file.path())).toEqual({ width: 1080, height: 1920 });
  if (process.env.STORY_SHOTS) {
    await file.saveAs(path.join(process.env.STORY_SHOTS, `${test.info().project.name}-mes.png`));
  }
});

test("mês sem refeições registradas mostra \"sem registros\"; mês inválido ou futuro não abre", async ({ page }) => {
  await page.goto(`/perfil/mes/${previous.slice(0, 7)}/story`);
  const card = page.getByTestId("month-card-preview");
  await expect(card.getByTestId("month-card-title")).toContainText(monthName(previous));
  await expect(card.getByTestId("month-card-adherence")).toContainText("Sem registros");
  await expect(card.getByTestId("month-card-achievements")).toContainText(`Nenhuma nova em ${monthName(previous)}`);
  expect(await outsideSafeArea(page)).toEqual([]);

  for (const month of ["2026-13", "outubro", addMonths(today, 1).slice(0, 7)]) {
    await page.goto(`/perfil/mes/${month}/story`);
    await expect(page.getByRole("heading", { level: 1, name: "Mês não encontrado" })).toBeVisible();
  }
});
