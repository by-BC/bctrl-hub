import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import { createDisposableUser, deleteDisposableUser, type DisposableUser } from "./disposable-user";
import { loginAndWaitForHome } from "./fixtures";

let user: DisposableUser;

test.beforeAll(async () => {
  user = await createDisposableUser("e2e-daily-story");
});

test.afterAll(async () => {
  await deleteDisposableUser(user);
});

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, "canShare", { value: undefined, configurable: true });
  });
  await loginAndWaitForHome(page, user.email, user.password);
});

async function pngSize(file: string) {
  const buf = await readFile(file);
  expect(buf.subarray(1, 4).toString("ascii")).toBe("PNG");
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

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

test("Perfil combines today's criteria in a shareable daily story", async ({ page }) => {
  await page.goto("/perfil");
  await page.getByRole("link", { name: "Criar um story" }).click();
  await expect(page).toHaveURL(/\/perfil\/stories$/);
  await page.getByRole("link", { name: /Seu dia em um story/ }).click();
  await expect(page).toHaveURL(/\/perfil\/story$/);
  await expect(page.getByRole("heading", { level: 1, name: "Story do dia" })).toBeVisible();

  const card = page.getByTestId("daily-card-preview");
  await expect(card.getByTestId("daily-card-score")).toBeVisible();
  for (const key of ["trained", "diet", "habits", "tasks"]) {
    await expect(card.getByTestId(`daily-criterion-${key}`)).toBeVisible();
  }
  expect(await outsideSafeArea(page)).toEqual([]);

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Baixar PNG" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/^bctrl-dia-\d{4}-\d{2}-\d{2}\.png$/);
  expect(await pngSize(await file.path())).toEqual({ width: 1080, height: 1920 });
});
