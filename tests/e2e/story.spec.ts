import { readFile } from "node:fs/promises";
import path from "node:path";
import { expect, test, type Page, type Request } from "@playwright/test";
import { dayInSaoPaulo } from "../../src/lib/domain/day";
import { createDisposableUser, deleteDisposableUser, seedTrainingPlan, seedWorkout, type DisposableUser } from "./disposable-user";
import { loginAndWaitForHome } from "./fixtures";

/** Largura × altura lidas do cabeçalho IHDR do PNG. */
async function pngSize(file: string) {
  const buf = await readFile(file);
  expect(buf.subarray(1, 4).toString("ascii")).toBe("PNG");
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

/** Exporta o layout visível pelo caminho de download e confere o PNG. */
async function exportCurrent(page: Page, layoutId: string) {
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Baixar PNG" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(new RegExp(`^bctrl-story-\\d{4}-\\d{2}-\\d{2}-${layoutId}\\.png$`));
  const saved = await file.path();
  expect(await pngSize(saved)).toEqual({ width: 1080, height: 1920 });
  // Opcional: guarda os PNGs para revisão visual (STORY_SHOTS=pasta).
  if (process.env.STORY_SHOTS) {
    await file.saveAs(path.join(process.env.STORY_SHOTS, `${test.info().project.name}-${layoutId}.png`));
  }
}

const layoutName = (page: Page) => page.getByTestId("story-layout-name");

test.describe("story studio", () => {
  let user: DisposableUser;
  let workoutId: string;

  test.beforeAll(async () => {
    user = await createDisposableUser("e2e-story");
    const plan = await seedTrainingPlan(user);
    workoutId = await seedWorkout(user, {
      routine: plan.upper,
      day: dayInSaoPaulo(new Date()),
      sets: [
        [plan.exercises.supino, [[40, 10], [42.5, 10, ["weight", "volume", "e1rm"]], [42.5, 8]]],
        [plan.exercises.remada, [[30, 12], [32, 12, ["weight", "volume"]]]],
      ],
    });
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

  test("percorre os 4 layouts e exporta cada um em 1080×1920; a foto não sai do aparelho", async ({ page }) => {
    test.setTimeout(120_000);

    await page.goto(`/treino/historico/${workoutId}`);
    await page.getByRole("link", { name: "Gerar story do treino" }).click();
    await expect(page).toHaveURL(new RegExp(`/treino/historico/${workoutId}/story$`));
    await expect(page.getByRole("heading", { level: 1, name: "Story do treino" })).toBeVisible();

    const carousel = page.getByRole("region", { name: "Layouts do story" });
    const slide = (name: string) => carousel.getByRole("group", { name: new RegExp(`^${name.replace("+", "\\+")}, `) });

    // 1. Recibo: dados do treino semeado (rotina, total = volume, PR em destaque).
    await expect(layoutName(page)).toContainText("Recibo");
    const recibo = slide("Recibo");
    await expect(recibo.getByText("Upper E2E")).toBeVisible();
    await expect(recibo.getByText("1.909")).toBeVisible(); // 400 + 425 + 340 + 360 + 384 = 1.909 kg
    await expect(recibo.getByText(/Recordes · 5/)).toBeVisible();
    await exportCurrent(page, "recibo");

    // 2. Hex Week: pelo botão "Próximo layout".
    await page.getByRole("button", { name: "Próximo layout" }).click();
    await expect(layoutName(page)).toContainText("Hex Week");
    await expect(slide("Hex Week").getByTestId("hex-progress")).toBeVisible();
    await exportCurrent(page, "hex-week");

    // 3. Blueprint: pelo teclado (seta para a direita no carrossel).
    await carousel.focus();
    await page.keyboard.press("ArrowRight");
    await expect(layoutName(page)).toContainText("Blueprint");
    await expect(slide("Blueprint").getByText("Lista de peças", { exact: false })).toBeVisible();
    await exportCurrent(page, "blueprint");

    // 4. Foto + overlay: pela lista de layouts. Sem foto, não exporta.
    await page.getByRole("button", { name: "Foto + overlay" }).click();
    await expect(layoutName(page)).toContainText("Foto + overlay");
    await expect(page.getByRole("button", { name: "Baixar PNG" })).toBeDisabled();

    // Imagem de teste gerada no próprio navegador (degradê 1200×1600 em JPEG).
    const base64 = await page.evaluate(() => {
      const c = document.createElement("canvas");
      c.width = 1200;
      c.height = 1600;
      const ctx = c.getContext("2d")!;
      const g = ctx.createLinearGradient(0, 0, 1200, 1600);
      g.addColorStop(0, "rgb(60, 90, 140)");
      g.addColorStop(1, "rgb(200, 120, 80)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 1200, 1600);
      return c.toDataURL("image/jpeg", 0.9).split(",")[1];
    });
    const image = Buffer.from(base64, "base64");

    const sent: Request[] = [];
    page.on("request", (r) => sent.push(r));

    await page.getByLabel("Foto do story").setInputFiles({ name: "treino.jpg", mimeType: "image/jpeg", buffer: image });
    const photo = slide("Foto + overlay").locator("img[data-story-photo]");
    await expect(photo).toHaveAttribute("src", /^data:image\/jpeg;base64,/);
    await page.getByLabel("Zoom").fill("130");
    await expect(page.getByText("130%")).toBeVisible();
    await exportCurrent(page, "foto");

    // Nenhuma requisição carregou a foto: nada com corpo grande, imagem ou multipart.
    for (const r of sent) {
      const body = r.postDataBuffer();
      const type = (await r.allHeaders())["content-type"] ?? "";
      expect(type, r.url()).not.toMatch(/image\/|multipart\//);
      expect(body?.length ?? 0, r.url()).toBeLessThan(10_000);
      expect(body?.toString("latin1") ?? "", r.url()).not.toContain("data:image");
    }
  });
});
