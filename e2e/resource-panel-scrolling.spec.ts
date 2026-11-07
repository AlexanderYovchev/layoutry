import { expect, test, type Locator, type Page } from "@playwright/test";
import type { EditorElementNode } from "../src/features/editor/types/document";
import { serializeProject } from "../src/features/project/utils/serializeProject";
import { gotoApp } from "./support/gotoApp";

/*
 * BC-03.2 — the left Resource panel's lists scroll inside the panel
 * (BC-03-B1), focus and selection scroll only the list, never the whole
 * panel content (BC-03-B2), and collapse/expand keeps the list's
 * position (BC-03-B3). Everything is measured on the real layout
 * (scrollHeight, clientHeight, scrollTop, bounding rectangles) with real
 * wheel, keyboard and pointer input.
 */

const SECTIONS = ["Elements", "Components"] as const;
const panel = (page: Page) => page.locator('aside[aria-label="Resource panel"]');
const undo = (page: Page) => page.getByRole("button", { name: "Undo", exact: true });

/** The active section's scroll region: the catalog results (named by the search field's aria-controls) or the Structure/placeholder region. */
async function region(page: Page): Promise<Locator> {
  const search = panel(page).getByRole("searchbox");
  if ((await search.count()) > 0) return page.locator(`[id="${await search.getAttribute("aria-controls")}"]`);
  return panel(page).locator('[role="tabpanel"] > div');
}

interface PanelLayout {
  region: { scrollTop: number; scrollHeight: number; clientHeight: number; scrollWidth: number; clientWidth: number; top: number; bottom: number };
  /** Everything above the list that must stay in place: section title, search, filters. */
  controlsVisible: { title: boolean; search: boolean | null; filters: boolean | null };
  /** Scroll offsets of the boxes that must never scroll. */
  stillBoxes: { wrapper: number; context: number; document: number; workspace: number };
  cardFitsWidth: boolean;
  documentScrollable: boolean;
  /** The list's own box lies inside the panel card (it is bounded, not clipped). */
  regionWithinPanel: boolean;
}

function readLayout(page: Page, regionSelector: string): Promise<PanelLayout> {
  return page.evaluate((selector) => {
    const aside = document.querySelector('aside[aria-label="Resource panel"]');
    const card = aside?.firstElementChild as HTMLElement | null;
    const wrapper = card?.children[1] as HTMLElement | undefined;
    const context = wrapper?.firstElementChild as HTMLElement | null | undefined;
    const list = document.querySelector<HTMLElement>(selector);
    if (!card || !wrapper || !context || !list) throw new Error("Resource panel structure not found");
    const cardRect = card.getBoundingClientRect();
    const inside = (element: Element | null) => {
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      return rect.height > 0 && rect.top >= cardRect.top - 0.5 && rect.bottom <= cardRect.bottom + 0.5;
    };
    const rect = list.getBoundingClientRect();
    return {
      region: { scrollTop: list.scrollTop, scrollHeight: list.scrollHeight, clientHeight: list.clientHeight, scrollWidth: list.scrollWidth, clientWidth: list.clientWidth, top: rect.top, bottom: rect.bottom },
      controlsVisible: { title: inside(context.querySelector("h2")) ?? false, search: inside(context.querySelector('input[type="search"]')), filters: inside(context.querySelector('[role="radiogroup"]')) },
      stillBoxes: { wrapper: wrapper.scrollTop, context: context.scrollTop, document: document.scrollingElement?.scrollTop ?? 0, workspace: document.querySelector('main[aria-label="Workspace"]')?.scrollTop ?? 0 },
      cardFitsWidth: card.scrollWidth <= card.clientWidth + 1,
      documentScrollable: (document.scrollingElement?.scrollHeight ?? 0) > innerHeight + 1,
      regionWithinPanel: rect.top >= cardRect.top - 0.5 && rect.bottom <= cardRect.bottom + 0.5,
    };
  }, regionSelector);
}

async function selectorOf(locator: Locator): Promise<string> {
  const id = await locator.getAttribute("id");
  return id ? `[id="${id}"]` : 'aside[aria-label="Resource panel"] [role="tabpanel"] > div';
}

/**
 * The panel is laid out correctly: the list is bounded by the panel and is
 * the only thing that scrolls. `workspaceMoved` is for steps where the
 * test itself scrolled the canvas (to click an element there).
 */
function expectPanelIntact(layout: PanelLayout, label: string, { workspaceMoved = false } = {}) {
  if (workspaceMoved) layout = { ...layout, stillBoxes: { ...layout.stillBoxes, workspace: 0 } };
  expect(layout.regionWithinPanel, `${label}: the list is bounded by the panel`).toBe(true);
  expect(layout.controlsVisible.title, `${label}: section title visible`).toBe(true);
  if (layout.controlsVisible.search !== null) expect(layout.controlsVisible.search, `${label}: search visible`).toBe(true);
  if (layout.controlsVisible.filters !== null) expect(layout.controlsVisible.filters, `${label}: filters visible`).toBe(true);
  expect(layout.stillBoxes, `${label}: only the list scrolls`).toEqual({ wrapper: 0, context: 0, document: 0, workspace: 0 });
  expect(layout.cardFitsWidth, `${label}: no horizontal overflow in the panel`).toBe(true);
  expect(layout.region.scrollWidth, `${label}: no horizontal scrolling in the list`).toBeLessThanOrEqual(layout.region.clientWidth + 1);
  expect(layout.documentScrollable, `${label}: the page itself never becomes scrollable`).toBe(false);
}

/**
 * Wheels over the list towards its top (deltaY < 0) or bottom edge until
 * it gets there; returns the final layout. Smooth scrolling applies a
 * wheel over several frames, so a step that hasn't moved yet is retried
 * before giving up (and the caller's assertions then report it).
 */
async function wheelToEnd(page: Page, list: Locator, deltaY = 400): Promise<PanelLayout> {
  const box = await list.boundingBox();
  if (!box) throw new Error("no list box");
  await page.mouse.move(box.x + box.width / 2, box.y + Math.min(80, box.height / 2));
  const selector = await selectorOf(list);
  const atEdge = (layout: PanelLayout) => (deltaY < 0 ? layout.region.scrollTop <= 0 : layout.region.scrollTop >= layout.region.scrollHeight - layout.region.clientHeight - 1);
  let stalls = 0;
  for (let step = 0; step < 80 && stalls < 4; step++) {
    const before = (await readLayout(page, selector)).region.scrollTop;
    await page.mouse.wheel(0, deltaY);
    const moved = await expect
      .poll(async () => { const layout = await readLayout(page, selector); return layout.region.scrollTop !== before || atEdge(layout); }, { timeout: 1_000 })
      .toBe(true)
      .then(() => true, () => false);
    const layout = await readLayout(page, selector);
    if (atEdge(layout)) return layout;
    stalls = moved ? 0 : stalls + 1;
  }
  return readLayout(page, selector);
}

/** Index of the first item (button or tree row) whose bottom is below the list's top edge. */
function firstVisibleItem(list: Locator): Promise<number> {
  return list.evaluate((element) => {
    const top = element.getBoundingClientRect().top;
    const items = Array.from(element.querySelectorAll('button, [role="treeitem"]'));
    return items.findIndex((item) => item.getBoundingClientRect().bottom > top + 1);
  });
}

/** `item` is fully inside the list's visible area (allowing only for its own transform, e.g. a focused tile's 3% scale). */
async function itemInside(list: Locator, item: Locator): Promise<boolean> {
  const handle = await list.elementHandle();
  return item.evaluate((element: HTMLElement, container) => {
    if (!container) return false;
    const rect = container.getBoundingClientRect();
    const box = element.getBoundingClientRect();
    const transformOverflow = Math.max(0, (box.height - element.offsetHeight) / 2) + 0.5;
    return box.top >= rect.top - transformOverflow && box.bottom <= rect.bottom + transformOverflow;
  }, handle);
}

function lastItemInside(list: Locator): Promise<boolean> {
  return list.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const items = element.querySelectorAll('button, [role="treeitem"]');
    const last = items[items.length - 1]?.getBoundingClientRect();
    return !!last && last.top >= rect.top - 0.5 && last.bottom <= rect.bottom + 0.5;
  });
}

async function openSection(page: Page, name: string) {
  await panel(page).getByRole("tab", { name }).click();
  await expect(panel(page).getByRole("tab", { name })).toHaveAttribute("aria-selected", "true");
}

const panelWidth = (page: Page) => panel(page).evaluate((element) => Math.round(element.getBoundingClientRect().width));

/** The exported code is a pure function of the document: identical text means an identical document. */
async function exportedCode(page: Page): Promise<string> {
  await page.getByRole("button", { name: "Export Code" }).click();
  const code = page.getByRole("dialog", { name: "Export Code" }).getByTestId("export-code");
  await expect(code).toBeVisible();
  const text = (await code.textContent()) ?? "";
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Export Code" })).toHaveCount(0);
  return text;
}

function longDocument(): EditorElementNode {
  const children: EditorElementNode[] = [];
  for (let index = 0; index < 60; index++) children.push({ id: `s-${index}`, tag: "section", children: [{ id: `p-${index}`, tag: "p", text: `Paragraph ${index}` }] });
  return { id: "page-root", tag: "page", children };
}

async function importLongDocument(page: Page) {
  const file = serializeProject({ metadata: { id: "00000000-0000-4000-8000-000000000320", name: "BC-03.2 long", createdAt: "2026-11-07T00:00:00.000Z", updatedAt: "2026-11-07T00:00:00.000Z" }, document: longDocument() });
  await page.getByTestId("project-import-input").setInputFiles({ name: "long.layoutry", mimeType: "application/json", buffer: Buffer.from(file) });
  await page.locator('[data-document-surface] [data-node-id="s-59"]').waitFor({ state: "attached", timeout: 60_000 });
}

const VIEWPORTS = [
  [1920, 1080],
  [1440, 900],
  [1280, 800],
  [1024, 768],
  [1440, 600],
  [1280, 600],
] as const;

test.describe("B1: every list scrolls inside the panel and every item is reachable", () => {
  for (const [width, height] of VIEWPORTS) {
    test(`${width}×${height}: Elements and Components`, async ({ page }) => {
      test.setTimeout(90_000);
      await page.setViewportSize({ width, height });
      await gotoApp(page);
      for (const name of SECTIONS) {
        await openSection(page, name);
        const list = await region(page);
        const before = await readLayout(page, await selectorOf(list));
        expect(before.region.scrollHeight, `${name}: the list overflows, so it can scroll`).toBeGreaterThan(before.region.clientHeight);
        expectPanelIntact(before, `${name} at the top`);
        const end = await wheelToEnd(page, list);
        expect(end.region.scrollTop, `${name}: the wheel reaches the end`).toBeGreaterThanOrEqual(end.region.scrollHeight - end.region.clientHeight - 2);
        expect(await lastItemInside(list), `${name}: the last tile is visible`).toBe(true);
        expectPanelIntact(end, `${name} at the end`);
        // And back to the top.
        const top = await wheelToEnd(page, list, -400);
        expect(top.region.scrollTop).toBe(0);
      }
    });
  }

  test("Structure: a long page's tree scrolls to its last row", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoApp(page);
    await importLongDocument(page);
    await openSection(page, "Structure");
    const list = await region(page);
    const start = await readLayout(page, await selectorOf(list));
    expect(start.region.scrollHeight).toBeGreaterThan(start.region.clientHeight);
    expectPanelIntact(start, "Structure at the top");
    const end = await wheelToEnd(page, list);
    expect(end.region.scrollTop).toBeGreaterThanOrEqual(end.region.scrollHeight - end.region.clientHeight - 2);
    expect(await lastItemInside(list), "the last row is visible").toBe(true);
    expectPanelIntact(end, "Structure at the end");
  });
});

test.describe("B2: keyboard focus and selection scroll the list, never the panel", () => {
  for (const name of SECTIONS) {
    test(`${name}: Tab through every tile keeps each focused tile visible and the controls in place`, async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 600 });
      await gotoApp(page);
      await openSection(page, name);
      const list = await region(page);
      const selector = await selectorOf(list);
      // Disabled ("not available yet") tiles are not in the Tab order.
      const tiles = list.locator("button:enabled");
      const count = await tiles.count();
      await tiles.first().focus();
      for (let index = 1; index < count; index++) {
        await page.keyboard.press("Tab");
        await expect(tiles.nth(index), `${name}: Tab reaches tile ${index + 1} of ${count}`).toBeFocused();
        await expect.poll(() => itemInside(list, tiles.nth(index)), { message: `${name}: tile ${index + 1} of ${count} is fully visible in the list`, timeout: 2_000 }).toBe(true);
        if (index % 8 === 0 || index === count - 1) expectPanelIntact(await readLayout(page, selector), `${name} after Tab ${index}`);
      }
      expect((await readLayout(page, selector)).region.scrollTop, `${name}: the list scrolled to follow focus`).toBeGreaterThan(0);
      // Shift+Tab back up the list: focus is followed upwards too.
      for (let index = 0; index < 6; index++) await page.keyboard.press("Shift+Tab");
      expectPanelIntact(await readLayout(page, selector), `${name} after Shift+Tab`);
    });
  }

  for (const name of SECTIONS) {
    test(`${name}: with focus in the list, PageDown, End and Home scroll the list natively`, async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await gotoApp(page);
      await openSection(page, name);
      const list = await region(page);
      const selector = await selectorOf(list);
      await list.locator("button:enabled").first().focus();
      await page.keyboard.press("PageDown");
      await expect.poll(async () => (await readLayout(page, selector)).region.scrollTop, { message: "PageDown scrolls the list" }).toBeGreaterThan(0);
      await page.keyboard.press("End");
      await expect.poll(async () => { const layout = await readLayout(page, selector); return layout.region.scrollTop >= layout.region.scrollHeight - layout.region.clientHeight - 1; }, { message: "End reaches the bottom" }).toBe(true);
      expectPanelIntact(await readLayout(page, selector), `${name} after End`);
      await page.keyboard.press("Home");
      await expect.poll(async () => (await readLayout(page, selector)).region.scrollTop, { message: "Home returns to the top" }).toBe(0);
      expectPanelIntact(await readLayout(page, selector), `${name} after Home`);
    });
  }

  test("Structure: selecting the last element and End in the tree scroll the tree only", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 600 });
    await gotoApp(page);
    await importLongDocument(page);
    await openSection(page, "Structure");
    const list = await region(page);
    const selector = await selectorOf(list);
    const last = page.locator('[data-document-surface] [data-node-id="p-59"]');
    await last.scrollIntoViewIfNeeded();
    await last.click();
    const row = list.locator('[role="treeitem"][aria-selected="true"]');
    await expect(row).toHaveCount(1);
    await expect.poll(() => lastItemInside(list), { message: "the selected (last) row is scrolled into view" }).toBe(true);
    expectPanelIntact(await readLayout(page, selector), "Structure after selecting the last element", { workspaceMoved: true });

    await wheelToEnd(page, list, -400);
    await list.locator('[role="treeitem"]').first().focus();
    await page.keyboard.press("End");
    await expect.poll(() => lastItemInside(list), { message: "End moves to and reveals the last row" }).toBe(true);
    expectPanelIntact(await readLayout(page, selector), "Structure after End", { workspaceMoved: true });
    await page.keyboard.press("Home");
    const firstRow = list.locator('[role="treeitem"]').first();
    await expect(firstRow).toBeFocused();
    await expect.poll(() => itemInside(list, firstRow), { message: "Home moves to and reveals the first row" }).toBe(true);
    expectPanelIntact(await readLayout(page, selector), "Structure after Home", { workspaceMoved: true });
  });
});

test.describe("B3: collapse and expand keep the active list's position; switching sections starts at the top", () => {
  for (const name of [...SECTIONS, "Structure"] as const) {
    test(`${name}: position kept across collapse and expand`, async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await gotoApp(page);
      if (name === "Structure") await importLongDocument(page);
      await openSection(page, name);
      const list = await region(page);
      const selector = await selectorOf(list);
      // Scroll part-way, then to the very end, checking the position survives each time.
      for (const wheel of [900, 100_000]) {
        const box = await list.boundingBox();
        if (!box) throw new Error("no list box");
        await page.mouse.move(box.x + box.width / 2, box.y + 80);
        await page.mouse.wheel(0, wheel);
        await expect.poll(async () => (await readLayout(page, selector)).region.scrollTop).toBeGreaterThan(0);
        // Let the scroll settle.
        let settled = -1;
        await expect.poll(async () => { const now = (await readLayout(page, selector)).region.scrollTop; const same = now === settled; settled = now; return same; }, { intervals: [150] }).toBe(true);
        const before = await readLayout(page, selector);
        const firstBefore = await firstVisibleItem(list);

        await page.getByRole("button", { name: "Collapse Resource panel" }).click();
        await expect.poll(() => panelWidth(page)).toBe(66);
        await page.getByRole("button", { name: "Expand Resource panel" }).click();
        await expect.poll(() => panelWidth(page)).toBe(280);

        const after = await readLayout(page, selector);
        expect(Math.abs(after.region.scrollTop - before.region.scrollTop), `${name}: scrollTop ${before.region.scrollTop} → ${after.region.scrollTop}`).toBeLessThanOrEqual(2);
        expect(await firstVisibleItem(list), `${name}: the same item is at the top`).toBe(firstBefore);
        expectPanelIntact(after, `${name} after expand`);
      }
    });
  }

  test("switching sections starts the new section at the top, and a section revisited starts at the top again", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoApp(page);
    await importLongDocument(page);
    for (const [from, to] of [["Elements", "Components"], ["Components", "Structure"], ["Structure", "Elements"], ["Structure", "Assets"]] as const) {
      await openSection(page, from);
      await wheelToEnd(page, await region(page));
      expect((await readLayout(page, await selectorOf(await region(page)))).region.scrollTop, `${from} scrolled`).toBeGreaterThan(0);
      await openSection(page, to);
      expect((await readLayout(page, await selectorOf(await region(page)))).region.scrollTop, `${from} → ${to} starts at the top`).toBe(0);
      await openSection(page, from);
      expect((await readLayout(page, await selectorOf(await region(page)))).region.scrollTop, `back to ${from} starts at the top`).toBe(0);
    }
  });
});

test.describe("drag-and-drop from a scrolled list", () => {
  for (const name of SECTIONS) {
    test(`${name}: the last tile, dragged from the bottom of the list, inserts the same component as clicking it, and Undo restores`, async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await gotoApp(page);
      const empty = await exportedCode(page);

      // Reference: the same tile inserted by click (the established path).
      await openSection(page, name);
      let list = await region(page);
      await wheelToEnd(page, list);
      // The lowest tile that can be inserted (some tiles are "not available yet").
      const tile = list.locator("button:enabled").last();
      const label = (await tile.textContent())?.trim() ?? "";
      await tile.click();
      await expect(undo(page)).toBeEnabled();
      const clicked = await exportedCode(page);
      expect(clicked).not.toBe(empty);
      await undo(page).click();
      expect(await exportedCode(page)).toBe(empty);

      // The same tile, dragged from the scrolled list onto the page sheet.
      await openSection(page, name === "Elements" ? "Components" : "Elements");
      await openSection(page, name);
      list = await region(page);
      const end = await wheelToEnd(page, list);
      // The tile was brought into view by scrolling the list itself, with the
      // panel's header and search still in place (not by scrolling the panel).
      expect(end.region.scrollTop, "the list itself scrolled").toBeGreaterThan(0);
      expectPanelIntact(end, `${name} scrolled to its end before the drag`);
      const dragTile = list.locator("button:enabled").last();
      await expect(dragTile).toHaveText(label);
      // A user can only drag what they can see: the tile is inside the list's visible area, under the pointer.
      expect(await itemInside(list, dragTile), `"${label}" is visible in the scrolled list`).toBe(true);
      // Drop just inside the bottom of the page sheet, below its content (where the click inserts too).
      // Scroll the Workspace to its end first: in Firefox the starter page is taller than the visible Workspace.
      const workspace = page.getByRole("main", { name: "Workspace" });
      await workspace.evaluate((element) => element.scrollTo({ top: element.scrollHeight }));
      const from = await dragTile.boundingBox();
      const sheet = await page.locator("[data-document-surface]").boundingBox();
      const workspaceBox = await workspace.boundingBox();
      if (!from || !sheet || !workspaceBox) throw new Error("no boxes");
      const dropY = Math.min(sheet.y + sheet.height, workspaceBox.y + workspaceBox.height) - 12;
      const underPointer = await page.evaluate(([x, y]) => document.elementFromPoint(x ?? 0, y ?? 0)?.closest("button")?.textContent?.trim() ?? null, [from.x + from.width / 2, from.y + from.height / 2]);
      expect(underPointer, "the pointer lands on the tile").toBe(label);
      const nodesBefore = await page.locator("[data-document-surface] [data-node-id]").evaluateAll((elements) => elements.map((element) => element.getAttribute("data-node-id")));
      await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
      await page.mouse.down();
      await page.mouse.move(from.x + from.width / 2 + 24, from.y + from.height / 2, { steps: 4 });
      await page.mouse.move(sheet.x + sheet.width / 2, dropY, { steps: 20 });
      await page.mouse.up();
      await expect(undo(page)).toBeEnabled();

      // The list did not jump while dragging or dropping.
      expect((await readLayout(page, await selectorOf(list))).region.scrollTop, "the list kept its position").toBe(end.region.scrollTop);
      // Same component, same placement as the click insertion.
      expect(await exportedCode(page), `dragging "${label}" inserts what clicking it inserts`).toBe(clicked);
      // The new node is on the canvas and can be selected there.
      const added = await page.locator("[data-document-surface] [data-node-id]").evaluateAll((elements, known) => elements.map((element) => element.getAttribute("data-node-id")).filter((id) => !known.includes(id)), nodesBefore);
      expect(added.length).toBeGreaterThan(0);
      const addedNode = page.locator(`[data-document-surface] [data-node-id="${added[0]}"]`);
      await addedNode.scrollIntoViewIfNeeded();
      const addedBox = await addedNode.boundingBox();
      if (!addedBox) throw new Error("no box for the inserted node");
      await page.mouse.click(addedBox.x + addedBox.width / 2, addedBox.y + addedBox.height / 2);
      await openSection(page, "Structure");
      await expect(panel(page).locator('[role="treeitem"][aria-selected="true"]')).toHaveCount(1);
      // Undo restores the previous document exactly.
      await undo(page).click();
      expect(await exportedCode(page)).toBe(empty);
    });
  }
});

test.describe("drag auto-scroll leaves the list alone", () => {
  test("dragging a tile out of an unscrolled list never scrolls the list, so repeated drags from the same spot keep working", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoApp(page);
    await openSection(page, "Elements");
    const list = await region(page);
    const selector = await selectorOf(list);
    const tile = list.getByRole("button", { name: /^Container/ }).first();
    const from = await tile.boundingBox();
    const sheet = await page.locator("[data-document-surface]").boundingBox();
    const workspace = await page.getByRole("main", { name: "Workspace" }).boundingBox();
    if (!from || !sheet || !workspace) throw new Error("no boxes");
    const start = { x: from.x + from.width / 2, y: from.y + from.height / 2 };
    // Towards the lower part of the page sheet: the path crosses the list's lower edge band.
    const end = { x: sheet.x + Math.min(300, sheet.width / 2), y: Math.min(sheet.y + 650, workspace.y + workspace.height - 60) };
    for (let drag = 1; drag <= 3; drag++) {
      const nodes = await page.locator("[data-document-surface] [data-node-id]").count();
      await page.mouse.move(start.x, start.y);
      await page.mouse.down();
      const scrollDuringDrag: number[] = [];
      for (let step = 1; step <= 15; step++) {
        await page.mouse.move(start.x + ((end.x - start.x) * step) / 15, start.y + ((end.y - start.y) * step) / 15);
        // Dwell in the list's edge band, where dnd-kit's auto-scroll would act.
        if (step <= 4) await page.waitForTimeout(120);
        scrollDuringDrag.push((await readLayout(page, selector)).region.scrollTop);
      }
      await page.waitForTimeout(150);
      await page.mouse.up();
      expect(scrollDuringDrag.every((value) => value === 0), `drag ${drag}: the list stayed at the top while dragging (${scrollDuringDrag.join(",")})`).toBe(true);
      expect((await readLayout(page, selector)).region.scrollTop, `drag ${drag}: the list stayed at the top after the drop`).toBe(0);
      await expect.poll(() => page.locator("[data-document-surface] [data-node-id]").count(), { message: `drag ${drag} inserted a Container` }).toBeGreaterThan(nodes);
      // A person's pause between two drags. WebKit ignores a new drag started within a few
      // milliseconds of the previous drop (dnd-kit's drop animation is still running), which no
      // person could do; it does the same on the code before BC-03.2 (verified), so it is not
      // part of what this test checks.
      await page.waitForTimeout(500);
    }
  });
});

test.describe("isolation from the Canvas and the Inspector", () => {
  test("wheeling the list never scrolls the Inspector, Workspace or page, at either end; and the reverse", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoApp(page);
    // A selection gives the Inspector a long, scrollable property list; scroll it part-way.
    await page.locator("[data-document-surface] h1").first().click();
    const inspector = page.locator('aside[aria-label="Inspector panel"]');
    const inspectorScroll = () => inspector.evaluate((element) => Array.from(element.querySelectorAll<HTMLElement>("*")).filter((child) => /(auto|scroll)/.test(getComputedStyle(child).overflowY) && child.scrollHeight > child.clientHeight).map((child) => child.scrollTop));
    const inspectorBox = await inspector.boundingBox();
    if (!inspectorBox) throw new Error("no inspector");
    await page.mouse.move(inspectorBox.x + inspectorBox.width / 2, inspectorBox.y + inspectorBox.height / 2);
    await page.mouse.wheel(0, 300);
    await expect.poll(async () => (await inspectorScroll()).some((value) => value > 0)).toBe(true);
    const inspectorBefore = await inspectorScroll();

    await openSection(page, "Components");
    const list = await region(page);
    const selector = await selectorOf(list);
    // Past the top edge, then past the bottom edge.
    await wheelToEnd(page, list, -400);
    await wheelToEnd(page, list, 400);
    const box = await list.boundingBox();
    if (!box) throw new Error("no list box");
    await page.mouse.move(box.x + box.width / 2, box.y + 80);
    await page.mouse.wheel(0, 1_000);
    await page.mouse.wheel(0, 1_000);
    const atEnd = await readLayout(page, selector);
    expectPanelIntact(atEnd, "after wheeling past the end");
    expect(await inspectorScroll(), "the Inspector did not move").toEqual(inspectorBefore);

    // Wheel over the Inspector and over the Workspace: the list does not move.
    await page.mouse.move(inspectorBox.x + inspectorBox.width / 2, inspectorBox.y + inspectorBox.height / 2);
    await page.mouse.wheel(0, -200);
    const workspace = await page.getByRole("main", { name: "Workspace" }).boundingBox();
    if (!workspace) throw new Error("no workspace");
    await page.mouse.move(workspace.x + workspace.width / 2, workspace.y + workspace.height / 2);
    await page.mouse.wheel(0, 300);
    await page.mouse.wheel(0, -300);
    expect((await readLayout(page, selector)).region.scrollTop, "the list did not move").toBe(atEnd.region.scrollTop);
  });
});

test.describe("panel width and short viewports", () => {
  test("at the narrowest and widest panel widths, at the minimum height, the list stays bounded, reachable and without horizontal overflow", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 600 });
    await gotoApp(page);
    const handle = page.getByRole("separator", { name: "Resize Resource Panel" });
    for (const target of [520, 220]) {
      const box = await handle.boundingBox();
      if (!box) throw new Error("no handle");
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width / 2 + (target === 520 ? 400 : -400), box.y + box.height / 2, { steps: 10 });
      await page.mouse.up();
      await expect(handle).toHaveAttribute("aria-valuenow", String(target));
      for (const name of SECTIONS) {
        await openSection(page, name);
        const list = await region(page);
        const start = await readLayout(page, await selectorOf(list));
        expect(start.region.scrollHeight, `${name} at ${target}px overflows`).toBeGreaterThan(start.region.clientHeight);
        expectPanelIntact(start, `${name} at ${target}px`);
        const end = await wheelToEnd(page, list);
        expect(await lastItemInside(list), `${name} at ${target}px: last tile reachable`).toBe(true);
        expectPanelIntact(end, `${name} at ${target}px, end`);
      }
    }
  });

  test("below the supported width the existing notice is still shown instead of the editor", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 768 });
    await gotoApp(page);
    await expect(page.getByRole("heading", { name: /works best on a larger screen/ })).toBeVisible();
    await expect(panel(page)).toHaveCount(0);
  });
});

test("scrolling, keyboard navigation and collapse never change the document or history", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await gotoApp(page);
  const before = await exportedCode(page);
  const status = await page.locator("[data-project-status]").getAttribute("data-project-status");
  for (const name of SECTIONS) {
    await openSection(page, name);
    const list = await region(page);
    await wheelToEnd(page, list);
    await list.locator("button").first().focus();
    for (let index = 0; index < 10; index++) await page.keyboard.press("Tab");
    await page.getByRole("button", { name: "Collapse Resource panel" }).click();
    await page.getByRole("button", { name: "Expand Resource panel" }).click();
  }
  expect(await exportedCode(page)).toBe(before);
  await expect(page.locator("[data-project-status]")).toHaveAttribute("data-project-status", status ?? "");
  await expect(undo(page)).toBeDisabled();
});
