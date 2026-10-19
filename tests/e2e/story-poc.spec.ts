import { expect, test } from "@playwright/test";
import { loginAndWaitForHome } from "./fixtures";

test("POC: exporta PNG 1080×1920", async ({ page }) => {
  await loginAndWaitForHome(page);
  await page.goto("/dev/story-poc");
  // Força o caminho de download (sem Web Share) para validar o arquivo.
  await page.evaluate(() => {
    Object.defineProperty(navigator, "canShare", { value: undefined, configurable: true });
  });

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Gerar e compartilhar PNG" }).click();
  expect((await download).suggestedFilename()).toBe("bctrl-story-poc.png");

  const result = JSON.parse((await page.getByTestId("poc-result").textContent()) ?? "{}");
  expect(result).toMatchObject({ width: 1080, height: 1920 });
});
