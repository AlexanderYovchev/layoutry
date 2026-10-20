import { expect, test } from "@playwright/test";
import path from "node:path";
import {
  documentNodeCount,
  dragInsertContainer,
} from "../desktop/support/layoutryApp";
import {
  extractedAppDir,
  extractedExe,
  launchPackaged,
  UNPACKED_EXE,
  type PackagedLayoutry,
} from "./support/packagedApp";
import { mainWindowState, processTree } from "./support/windows";

let layoutry: PackagedLayoutry | undefined;

test.afterEach(async () => {
  await layoutry?.dispose();
  layoutry = undefined;
});

test("release/win-unpacked/Layoutry.exe launches the editor", async () => {
  layoutry = await launchPackaged(UNPACKED_EXE);
  const { page, pid } = layoutry;
  await expect(page).toHaveTitle("Layoutry");
  expect(page.url()).toBe("app://layoutry/");
  const main = processTree(pid)[0];
  expect(path.resolve(main.path)).toBe(path.resolve(UNPACKED_EXE));
  test.info().annotations.push({ type: "executable", description: main.path });
});

test("the extracted ZIP runs offline from a Unicode path with a clean profile", async () => {
  layoutry = await launchPackaged(extractedExe());
  const { page, pid } = layoutry;

  // Running from the extracted folder — no repository, no node_modules.
  const main = processTree(pid)[0];
  expect(path.resolve(main.path)).toBe(path.resolve(extractedExe()));
  expect(extractedAppDir()).toMatch(/Layoutry Alpha Тест 測試$/);
  test.info().annotations.push({ type: "executable", description: main.path });

  expect(mainWindowState(pid)).toMatchObject({
    title: "Layoutry",
    visible: true,
    minimized: false,
  });
  await expect(page).toHaveTitle("Layoutry");

  // A full in-app reload under observation: every request must stay on app://.
  const requests: string[] = [];
  const consoleErrors: string[] = [];
  page.on("request", (request) => requests.push(request.url()));
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => consoleErrors.push(String(error)));
  await page.evaluate(() => location.assign("app://layoutry/"));
  await page.waitForLoadState("load");
  await expect(
    page.locator("[data-document-surface] h1").first(),
  ).toBeVisible();

  const resources = await page.evaluate(() =>
    performance.getEntriesByType("resource").map((entry) => entry.name),
  );
  expect(requests.length).toBeGreaterThan(5);
  expect(requests.filter((url) => !url.startsWith("app://layoutry/"))).toEqual(
    [],
  );
  expect(resources.filter((url) => !url.startsWith("app://layoutry/"))).toEqual(
    [],
  );
  expect(consoleErrors).toEqual([]);

  const styling = await page.evaluate(async () => {
    await document.fonts.ready;
    return {
      styleSheets: document.styleSheets.length,
      bodyFont: getComputedStyle(document.body).fontFamily,
      interAvailable: document.fonts.check('16px "Inter"'),
      scripts: document.querySelectorAll("script[src]").length,
    };
  });
  expect(styling.styleSheets).toBeGreaterThan(0);
  expect(styling.scripts).toBeGreaterThan(0);
  expect(styling.bodyFont).toMatch(/^Inter\b/);
  expect(styling.interAvailable).toBe(true);
});

test("the packaged editor is fully interactive", async () => {
  layoutry = await launchPackaged(extractedExe());
  const { page } = layoutry;
  const inspector = page.getByRole("complementary", {
    name: "Inspector panel",
  });
  await expect(
    page.getByRole("complementary", { name: "Resource panel" }),
  ).toBeVisible();
  await expect(page.getByRole("main", { name: "Workspace" })).toBeVisible();
  await expect(inspector).toBeVisible();

  // Selection → Inspector
  await page.locator("[data-document-surface] h1").first().click();
  await expect(inspector.getByText("heading-1")).toBeVisible();

  // Drag-to-insert, undo, redo
  const before = await documentNodeCount(page);
  await dragInsertContainer(page);
  await expect.poll(() => documentNodeCount(page)).toBe(before + 1);
  await page.keyboard.press("Control+z");
  await expect.poll(() => documentNodeCount(page)).toBe(before);
  await page.keyboard.press("Control+y");
  await expect.poll(() => documentNodeCount(page)).toBe(before + 1);

  // Design ↔ Preview
  const status = page.getByRole("contentinfo", { name: "Status bar" });
  await page.getByRole("button", { name: "Enter Preview" }).click();
  await expect(status).toContainText("Preview mode");
  await page.getByRole("button", { name: "Exit Preview" }).click();
  await expect(status).toContainText("Design mode");

  // Reload shortcuts are swallowed: same document, same unsaved node.
  await page.evaluate(() => Reflect.set(window, "__notReloaded", true));
  for (const shortcut of [
    "F5",
    "Control+r",
    "Control+Shift+r",
    "Control+F5",
    "Shift+F5",
  ]) {
    await page.keyboard.press(shortcut);
    await page.waitForTimeout(300);
    expect(
      await page.evaluate(() => Reflect.get(window, "__notReloaded")),
      shortcut,
    ).toBe(true);
  }
  expect(await documentNodeCount(page)).toBe(before + 1);
});
