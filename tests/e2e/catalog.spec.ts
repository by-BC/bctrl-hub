import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  CATALOG_MEDIA,
  createDisposableUser,
  deleteDisposableUser,
  seedCatalog,
  type CatalogSeed,
  type DisposableUser,
} from "./disposable-user";
import { loginAndWaitForHome } from "./fixtures";

/**
 * v2 (task 3.0): catálogo de exercícios com busca, chips de músculo e equipamento, detalhe com
 * mídia por link (ou placeholder) e instruções próprias; o seletor usa os mesmos filtros.
 * O CDN do Hevy nunca é acessado de verdade: os testes interceptam os hosts.
 */

const CDN = /pump-app\.s3\.eu-west-2\.amazonaws\.com|d2l9nsnmtah87f\.cloudfront\.net/;
// PNG 1×1 transparente.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64",
);

const chip = (scope: Page | Locator, group: "músculo principal" | "equipamento", name: string) =>
  scope.getByRole("group", { name: `Filtrar por ${group}` }).getByRole("button", { name, exact: true });

/** A linha do catálogo (nome + músculo · equipamento) abre o detalhe. */
const openDetail = (page: Page, name: string) =>
  page
    .getByRole("list", { name: "Biblioteca de exercícios" })
    .getByTestId("catalog-item")
    .filter({ hasText: name })
    .getByRole("button", { name: new RegExp(`^${name.replace(/[()]/g, "\\$&")}`) });

async function noHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

test.describe("catálogo de exercícios", () => {
  let user: DisposableUser;
  let seed: CatalogSeed;

  test.beforeAll(async () => {
    user = await createDisposableUser("e2e-catalogo");
    seed = await seedCatalog(user);
  });
  test.afterAll(async () => {
    await deleteDisposableUser(user);
  });
  test.beforeEach(async ({ page }) => {
    await loginAndWaitForHome(page, user.email, user.password);
  });

  test("Peito + Halter filtra, abre o detalhe com instruções e, sem CDN, mostra placeholders", async ({ page }) => {
    await page.route(CDN, (route) => route.abort());
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/treino/exercicios");

    const list = page.getByRole("list", { name: "Biblioteca de exercícios" });
    await expect(page.getByText("49 de 49 exercícios")).toBeVisible();
    // Paginação no cliente: 40 primeiro, o resto ao pedir mais.
    await expect(list.getByTestId("catalog-item")).toHaveCount(40);
    await page.getByRole("button", { name: /Mostrar mais/ }).click();
    await expect(list.getByTestId("catalog-item")).toHaveCount(49);

    await chip(page, "músculo principal", "Peito").click();
    await chip(page, "equipamento", "Halter").click();
    await expect(chip(page, "músculo principal", "Peito")).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText("2 de 49 exercícios")).toBeVisible();
    await expect(list.getByTestId("catalog-item")).toHaveText([
      /Crucifixo Catálogo \(Halter\)\s*Peito · Halter/,
      /Supino Catálogo \(Halter\)\s*Peito · Halter/,
    ]);
    // Miniaturas bloqueadas: placeholder no lugar, sem quebrar o layout.
    await expect(list.getByTestId("media-placeholder")).toHaveCount(2);
    await expect(list.getByTestId("exercise-thumb")).toHaveCount(0);
    await noHorizontalScroll(page);

    // Busca sem acento combina com os chips.
    await page.getByLabel("Buscar exercício").fill("catalogo supino");
    await expect(list.getByTestId("catalog-item")).toHaveCount(1);

    await openDetail(page, "Supino Catálogo (Halter)").click();
    const detail = page.getByRole("dialog", { name: "Supino Catálogo (Halter)" });
    await expect(detail.getByTestId("exercise-instructions")).toContainText("Execução: empurre os halteres.");
    await expect(detail.getByRole("heading", { name: "Músculos secundários" })).toBeVisible();
    await expect(detail.getByText("Tríceps", { exact: true })).toBeVisible();
    await expect(detail.getByTestId("media-placeholder")).toContainText("Peito");
    await expect(detail.getByRole("link", { name: "Ver evolução" })).toHaveAttribute(
      "href",
      `/evolucao/${seed.exercises.supinoHalter}`,
    );
    await noHorizontalScroll(page);

    await page.keyboard.press("Escape");
    await expect(detail).toBeHidden();
    await page.getByRole("button", { name: "Limpar filtros" }).click();
    await expect(page.getByText("49 de 49 exercícios")).toBeVisible();
  });

  test("com o CDN no ar, a miniatura carrega por link e o vídeo só existe no detalhe", async ({ page }) => {
    const requested: string[] = [];
    await page.route(CDN, (route) => {
      const url = route.request().url();
      requested.push(url);
      return url.endsWith(".jpg") ? route.fulfill({ status: 200, contentType: "image/png", body: PNG }) : route.abort();
    });
    await page.goto("/treino/exercicios");
    await page.getByLabel("Buscar exercício").fill("supino catalogo halter");
    const thumb = page.getByTestId("exercise-thumb");
    await expect(thumb).toHaveAttribute("src", CATALOG_MEDIA.thumb("supino"));
    await expect(thumb).toHaveAttribute("loading", "lazy");
    await expect(page.getByTestId("exercise-video")).toHaveCount(0);
    expect(requested.some((url) => url.endsWith(".mp4"))).toBe(false);

    await openDetail(page, "Supino Catálogo (Halter)").click();
    const detail = page.getByRole("dialog", { name: "Supino Catálogo (Halter)" });
    // Vídeo bloqueado: cai na miniatura (e não no placeholder).
    await expect(detail.getByTestId("exercise-image")).toBeVisible();
    await expect(detail.getByTestId("media-placeholder")).toHaveCount(0);
  });

  test("seletor da rotina usa os filtros e adiciona o exercício do catálogo", async ({ page }) => {
    await page.route(CDN, (route) => route.abort());
    await page.goto(`/treino/rotinas/${seed.routine}`);
    await expect(page.getByTestId("routine-item-name")).toHaveText(["Remada Catálogo (Halter)"]);

    await page.getByRole("button", { name: "Adicionar exercício" }).click();
    const picker = page.getByRole("dialog", { name: "Adicionar exercício" });
    await chip(picker, "músculo principal", "Peito").click();
    await chip(picker, "equipamento", "Halter").click();
    const options = picker.getByRole("list", { name: "Exercícios" }).getByRole("button");
    await expect(options).toHaveCount(2);

    const saved = page.waitForResponse(
      (r) => r.url().includes("/rest/v1/routine_exercises") && r.request().method() !== "GET",
    );
    await options.filter({ hasText: "Supino Catálogo (Halter)" }).click();
    expect((await saved).ok()).toBe(true);
    await expect(picker).toBeHidden();
    await expect(page.getByTestId("routine-item-name")).toHaveText([
      "Remada Catálogo (Halter)",
      "Supino Catálogo (Halter)",
    ]);
  });

  test("na sessão, as instruções do exercício ficam recolhidas e abrem ao toque", async ({ page }) => {
    await page.route(CDN, (route) => route.abort());
    await page.goto("/treino");
    const card = page.getByTestId("next-workout-card");
    await expect(card).toContainText("Rotina Catálogo");
    await card.getByRole("button", { name: "Iniciar treino" }).click();
    await expect(page).toHaveURL(/\/treino\/sessao$/);

    const remada = page.getByRole("article", { name: "Remada Catálogo (Halter)" });
    const block = remada.getByTestId("session-instructions");
    await expect(block).toBeVisible();
    await expect(block.getByText("puxe os halteres até a cintura", { exact: false })).toBeHidden();
    await block.getByText("Como executar").click();
    await expect(block.getByText("puxe os halteres até a cintura", { exact: false })).toBeVisible();

    // Não deixa sessão aberta no aparelho do teste.
    await page.getByRole("button", { name: "Descartar treino" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Descartar treino" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Nenhum treino em andamento" })).toBeVisible();
  });
});
