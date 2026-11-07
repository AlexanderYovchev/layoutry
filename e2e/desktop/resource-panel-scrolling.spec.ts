import { expect, test, type Page } from "@playwright/test";
import { launchLayoutry, type LaunchedLayoutry } from "./support/layoutryApp";

/**
 * BC-03.2 in the real Electron window: the Resource panel's lists scroll
 * inside the panel with the real (15 px, classic Windows) scrollbar, which
 * covers no tile; collapse/expand keeps the position; the window can be
 * maximized and restored. Headless browsers use 0 px overlay scrollbars,
 * so this is the only place the real scrollbar is measured.
 */

let layoutry: LaunchedLayoutry | undefined;

test.afterEach(async () => {
  await layoutry?.dispose();
  layoutry = undefined;
});

function measure(page: Page) {
  return page.evaluate(() => {
    const aside = document.querySelector('aside[aria-label="Resource panel"]');
    const card = aside?.firstElementChild as HTMLElement | null;
    const search = aside?.querySelector('input[type="search"]');
    const list = document.getElementById(search?.getAttribute("aria-controls") ?? "");
    if (!card || !search || !list) throw new Error("Resource panel structure not found");
    const cardRect = card.getBoundingClientRect();
    const listRect = list.getBoundingClientRect();
    const contentRight = listRect.left + list.clientWidth;
    const tiles = Array.from(list.querySelectorAll("button"));
    const last = tiles[tiles.length - 1]?.getBoundingClientRect();
    const title = card.querySelector("h2")?.getBoundingClientRect();
    const searchRect = search.getBoundingClientRect();
    return {
      scrollTop: list.scrollTop,
      maxScroll: list.scrollHeight - list.clientHeight,
      bounded: listRect.top >= cardRect.top - 0.5 && listRect.bottom <= cardRect.bottom + 0.5,
      scrollbarWidth: list.offsetWidth - list.clientWidth,
      tilesUnderScrollbar: tiles.filter((tile) => tile.getBoundingClientRect().right > contentRight + 0.5).length,
      lastTileVisible: !!last && last.top >= listRect.top - 0.5 && last.bottom <= listRect.bottom + 0.5,
      controlsVisible: !!title && title.top >= cardRect.top - 0.5 && searchRect.top >= cardRect.top - 0.5,
      workspaceScroll: document.querySelector('main[aria-label="Workspace"]')?.scrollTop ?? -1,
    };
  });
}

async function wheelToEnd(page: Page) {
  const id = await page.getByRole("complementary", { name: "Resource panel" }).getByRole("searchbox").getAttribute("aria-controls");
  const box = await page.locator(`[id="${id}"]`).boundingBox();
  if (!box) throw new Error("no list box");
  await page.mouse.move(box.x + box.width / 2, box.y + 80);
  for (let step = 0; step < 40; step++) {
    await page.mouse.wheel(0, 500);
    const now = await measure(page);
    if (now.scrollTop >= now.maxScroll - 1) return;
  }
}

const panelWidth = (page: Page) => page.locator('aside[aria-label="Resource panel"]').evaluate((element) => Math.round(element.getBoundingClientRect().width));

test("Resource panel lists scroll in the desktop window, with the real scrollbar, across collapse, maximize and restore", async () => {
  layoutry = await launchLayoutry();
  const { app, page } = layoutry;
  for (const name of ["Elements", "Components"]) {
    await page.getByRole("tab", { name }).click();
    const start = await measure(page);
    expect(start.bounded, `${name}: bounded by the panel`).toBe(true);
    expect(start.maxScroll, `${name}: overflows, so it scrolls`).toBeGreaterThan(0);
    expect(start.scrollbarWidth, `${name}: a real scrollbar is shown`).toBeGreaterThan(0);
    expect(start.tilesUnderScrollbar, `${name}: no tile is under the scrollbar`).toBe(0);
    await wheelToEnd(page);
    await expect.poll(async () => (await measure(page)).lastTileVisible, { message: `${name}: the last tile is reached` }).toBe(true);
    const end = await measure(page);
    expect(end.controlsVisible, `${name}: title and search stay visible`).toBe(true);
    expect(end.workspaceScroll, `${name}: the Workspace does not scroll`).toBe(0);
  }

  // Collapse and expand keep the position (Components, scrolled to the end).
  const kept = (await measure(page)).scrollTop;
  await page.getByRole("button", { name: "Collapse Resource panel" }).click();
  await expect.poll(() => panelWidth(page)).toBe(66);
  await page.getByRole("button", { name: "Expand Resource panel" }).click();
  await expect.poll(() => panelWidth(page)).toBe(280);
  expect(Math.abs((await measure(page)).scrollTop - kept), "the position survives collapse/expand").toBeLessThanOrEqual(2);

  // Maximize and restore: still bounded, still scrollable, nothing under the scrollbar.
  for (const action of ["maximize", "unmaximize"] as const) {
    await app.evaluate(({ BrowserWindow }, method) => BrowserWindow.getAllWindows()[0]?.[method](), action);
    await expect.poll(async () => (await measure(page)).bounded, { message: `bounded after ${action}` }).toBe(true);
    const state = await measure(page);
    expect(state.maxScroll, `scrollable after ${action}`).toBeGreaterThan(0);
    expect(state.tilesUnderScrollbar, `no tile under the scrollbar after ${action}`).toBe(0);
    expect(state.controlsVisible, `controls visible after ${action}`).toBe(true);
  }
});
