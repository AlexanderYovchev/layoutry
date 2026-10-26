import { expect, test, type Page } from "@playwright/test";
import {
  documentNodeCount,
  dragInsertContainer,
} from "../desktop/support/layoutryApp";
import {
  extractedExe,
  launchPackaged,
  type PackagedLayoutry,
} from "./support/packagedApp";
import {
  mainWindowGeometry,
  mainWindowState,
  resizeMainWindow,
  showMainWindow,
} from "./support/windows";

/**
 * DESKTOP-0.5 — window behavior of the packaged exe, driven through real
 * Win32 window operations. Display scaling other than the machine's own is
 * SIMULATED with Chromium's --force-device-scale-factor; it is not a
 * substitute for changing Windows' display settings.
 */

let layoutry: PackagedLayoutry | undefined;

test.afterEach(async () => {
  await layoutry?.dispose();
  layoutry = undefined;
});

const panelWidth = (page: Page, name: string) =>
  page
    .getByRole("complementary", { name })
    .evaluate((element) => Math.round(element.getBoundingClientRect().width));

function viewport(page: Page) {
  return page.evaluate(() => ({
    width: innerWidth,
    height: innerHeight,
    devicePixelRatio,
    overflowX:
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
    editorShown: document.querySelector("[data-document-surface]") !== null,
  }));
}

async function expectInsideViewport(
  page: Page,
  selector: Parameters<Page["getByRole"]>,
) {
  const box = await page.getByRole(...selector).boundingBox();
  const size = await page.evaluate(() => ({
    width: innerWidth,
    height: innerHeight,
  }));
  expect(box, String(selector[0])).not.toBeNull();
  if (!box) return;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(size.width + 1);
  expect(box.y + box.height).toBeLessThanOrEqual(size.height + 1);
}

test("maximize, restore and minimize keep the editor and its document intact", async () => {
  layoutry = await launchPackaged(extractedExe());
  const { page, pid } = layoutry;
  const before = await documentNodeCount(page);
  await dragInsertContainer(page);
  await expect.poll(() => documentNodeCount(page)).toBe(before + 1);
  const restored = mainWindowGeometry(pid);

  showMainWindow(pid, "maximize");
  await expect.poll(() => mainWindowGeometry(pid).maximized).toBe(true);
  await expect
    .poll(async () => (await viewport(page)).width)
    .toBeGreaterThan(restored.width - 20);
  expect(await viewport(page)).toMatchObject({
    overflowX: 0,
    editorShown: true,
  });

  showMainWindow(pid, "restore");
  await expect.poll(() => mainWindowGeometry(pid).maximized).toBe(false);

  showMainWindow(pid, "minimize");
  await expect.poll(() => mainWindowState(pid).minimized).toBe(true);
  showMainWindow(pid, "restore");
  await expect.poll(() => mainWindowState(pid).minimized).toBe(false);
  expect(await viewport(page)).toMatchObject({
    overflowX: 0,
    editorShown: true,
  });
  expect(await documentNodeCount(page)).toBe(before + 1);
});

test("the window cannot be shrunk below the editor's 900×600 viewport floor", async () => {
  layoutry = await launchPackaged(extractedExe());
  const { page, pid } = layoutry;
  const before = await documentNodeCount(page);

  resizeMainWindow(pid, 300, 200);
  await page.waitForTimeout(500);
  const atMinimum = await viewport(page);
  expect(atMinimum.width).toBeGreaterThanOrEqual(900);
  expect(atMinimum.height).toBeGreaterThanOrEqual(600);
  expect(atMinimum).toMatchObject({ overflowX: 0, editorShown: true });
  expect(await documentNodeCount(page)).toBe(before);

  resizeMainWindow(pid, 1280, 800);
  await expect
    .poll(async () => (await viewport(page)).width)
    .toBeGreaterThan(1200);
  expect(await viewport(page)).toMatchObject({
    overflowX: 0,
    editorShown: true,
  });
});

test("side panels resize by their handles and collapse to rails", async () => {
  layoutry = await launchPackaged(extractedExe());
  const { page } = layoutry;
  const inspectorBefore = await panelWidth(page, "Inspector panel");
  const handle = page.getByRole("separator", {
    name: "Resize Inspector Panel",
  });
  const box = await handle.boundingBox();
  if (!box) throw new Error("resize handle not visible");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 - 80, box.y + box.height / 2, {
    steps: 8,
  });
  await page.mouse.up();
  await expect
    .poll(() => panelWidth(page, "Inspector panel"))
    .toBe(inspectorBefore + 80);

  await page.getByRole("button", { name: "Collapse Resource panel" }).click();
  await page.getByRole("button", { name: "Collapse Inspector panel" }).click();
  await expect.poll(() => panelWidth(page, "Resource panel")).toBe(66);
  await expect.poll(() => panelWidth(page, "Inspector panel")).toBe(56);
  await page.getByRole("button", { name: "Expand Resource panel" }).click();
  await page.getByRole("button", { name: "Expand Inspector panel" }).click();
  await expect
    .poll(() => panelWidth(page, "Inspector panel"))
    .toBe(inspectorBefore + 80);
  expect(await viewport(page)).toMatchObject({ overflowX: 0 });
});

test("keyboard focus moves through the editor and long panels scroll", async () => {
  layoutry = await launchPackaged(extractedExe());
  const { page } = layoutry;
  await page
    .locator('[data-document-surface] [data-node-id="heading-1"]')
    .click();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  const focused = await page.evaluate(() => {
    const element = document.activeElement;
    return element && element !== document.body ? element.tagName : null;
  });
  expect(focused).not.toBeNull();

  const scroller = await page
    .getByRole("complementary", { name: "Inspector panel" })
    .evaluateHandle(
      (panel) =>
        [...panel.querySelectorAll("*")].find(
          (element) =>
            element.scrollHeight > element.clientHeight + 50 &&
            /^(auto|scroll)$/.test(getComputedStyle(element).overflowY),
        ) ?? null,
    );
  const scrollable = scroller.asElement();
  expect(scrollable, "Inspector has a scrolling region").not.toBeNull();
  if (!scrollable) return;
  const box = await scrollable.boundingBox();
  if (!box) throw new Error("Inspector scroller not visible");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, 600);
  await expect
    .poll(() => scrollable.evaluate((element) => element.scrollTop))
    .toBeGreaterThan(0);
});

for (const scale of ["1.25", "1.5"]) {
  test(`SIMULATED ${Number(scale) * 100}% display scaling: layout, menus, dialogs and the size floor`, async () => {
    layoutry = await launchPackaged(extractedExe(), {
      args: [`--force-device-scale-factor=${scale}`],
    });
    const { page, pid } = layoutry;
    const initial = await viewport(page);
    expect(initial.devicePixelRatio).toBe(Number(scale));
    expect(initial).toMatchObject({ overflowX: 0, editorShown: true });

    await page.getByRole("menuitem", { name: "File" }).click();
    await expectInsideViewport(page, ["menu"]);
    await page.keyboard.press("Escape");

    await page.getByRole("menuitem", { name: "Help" }).click();
    await page.getByRole("menuitem", { name: "About Layoutry" }).click();
    await expectInsideViewport(page, ["dialog", { name: "About Layoutry" }]);
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("dialog", { name: "About Layoutry" }),
    ).toBeHidden();

    await page.getByRole("button", { name: "Components" }).click();
    await expectInsideViewport(page, ["menu"]);
    await page.keyboard.press("Escape");

    resizeMainWindow(pid, 300, 200);
    await page.waitForTimeout(500);
    const atMinimum = await viewport(page);
    expect(atMinimum.width).toBeGreaterThanOrEqual(900);
    expect(atMinimum).toMatchObject({ overflowX: 0, editorShown: true });
  });
}
