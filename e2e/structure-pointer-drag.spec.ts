import { expect, test, type Page } from "@playwright/test";
import { gotoApp } from "./support/gotoApp";
import { importDocument } from "./support/parityFixtures";
import type { EditorElementNode } from "../src/features/editor/types/document";

/*
 * BC-12.3 in the real browser: Structure panel pointer drag from the row
 * handle — before/after/inside, Flow → Free, the refused-drop indicator and
 * notice, auto-expand, edge auto-scroll, Escape, Preview/Export order, touch
 * and pen (Chromium's CDP input), and a 1,000-row tree.
 */

const SURFACE = "[data-document-surface]";
const element = (page: Page, id: string) => page.locator(`${SURFACE} [data-node-id="${id}"]`);
const rowById = (page: Page, id: string) => page.locator(`[data-structure-row-id="${id}"]`);
const handleOf = (page: Page, id: string) => rowById(page, id).locator("[data-structure-drag-handle]");
const indicator = (page: Page) => page.locator("[data-structure-drop-indicator]");
const announcement = (page: Page) => page.locator("[data-structure-move-announcement]");
const button = (page: Page, name: string) => page.getByRole("button", { name, exact: true });
const childIds = (page: Page, id: string) =>
  page.locator(`${SURFACE} [data-node-id="${id}"] > [data-node-id]`).evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-node-id")));

const p = (id: string, text: string): EditorElementNode => ({ id, tag: "p", text, displayName: text });

const fixture: EditorElementNode = {
  id: "page-root",
  tag: "page",
  children: [
    { id: "d-h", tag: "h1", text: "Title", displayName: "Title" },
    { id: "d-s1", tag: "section", displayName: "Section One", children: [p("d-a", "Alpha"), p("d-b", "Beta"), p("d-c", "Gamma")] },
    {
      id: "d-s2",
      tag: "section",
      displayName: "Section Two",
      children: [{ id: "d-inner", tag: "div", displayName: "Inner box", children: [p("d-deep", "Deep")] }],
    },
    { id: "d-list", tag: "ul", displayName: "List", children: [{ id: "d-li", tag: "li", text: "Item", displayName: "Item" }] },
    {
      id: "d-free",
      tag: "div",
      displayName: "Free box",
      layoutMode: "free",
      dimensions: { preferredWidth: 600, preferredHeight: 260, offsetX: 0, offsetY: 0 },
      children: [],
    },
  ],
};

async function open(page: Page, document: EditorElementNode = fixture, waitFor = "d-free") {
  await gotoApp(page);
  await importDocument(page, document, waitFor);
  await page.getByRole("tab", { name: "Structure" }).click();
}

/** The point in a row's before / inside / after band (resolveDropZone: 25 / 50 / 25 % for containers, 50 / 50 for leaves). */
async function zonePoint(page: Page, id: string, zone: "before" | "inside" | "after") {
  const box = (await rowById(page, id).boundingBox())!;
  const fraction = zone === "before" ? 0.12 : zone === "after" ? 0.88 : 0.5;
  return { x: box.x + box.width * 0.4, y: box.y + box.height * fraction };
}

async function pickUp(page: Page, id: string) {
  await rowById(page, id).hover();
  const box = (await handleOf(page, id).boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 8, { steps: 3 });
}

async function hoverZone(page: Page, id: string, zone: "before" | "inside" | "after") {
  const point = await zonePoint(page, id, zone);
  await page.mouse.move(point.x, point.y, { steps: 6 });
}

async function drag(page: Page, id: string, targetId: string, zone: "before" | "inside" | "after") {
  await pickUp(page, id);
  await hoverZone(page, targetId, zone);
  await expect(indicator(page)).toHaveAttribute("data-structure-drop-indicator", zone);
  await page.mouse.up();
}

test("1: before/after/inside drops reorder through the shared move; one Undo each; the moved row stays selected and focused", async ({ page }) => {
  await open(page);
  await drag(page, "d-c", "d-a", "before");
  await expect.poll(() => childIds(page, "d-s1")).toEqual(["d-c", "d-a", "d-b"]);
  await expect(rowById(page, "d-c")).toHaveAttribute("aria-selected", "true");
  await expect(rowById(page, "d-c")).toBeFocused();
  await expect(announcement(page)).toHaveText(/^Moved Gamma to the start of Section One, position 1 of 3\.\s*$/);
  await expect(page.locator("[data-structure-drag-preview]")).toHaveCount(0);

  await drag(page, "d-c", "d-b", "after");
  await expect.poll(() => childIds(page, "d-s1")).toEqual(["d-a", "d-b", "d-c"]);

  await drag(page, "d-a", "d-inner", "inside");
  await expect.poll(() => childIds(page, "d-inner")).toEqual(["d-deep", "d-a"]);
  await expect(rowById(page, "d-a")).toHaveAttribute("aria-level", "4");

  await button(page, "Undo").click();
  await expect.poll(() => childIds(page, "d-s1")).toEqual(["d-a", "d-b", "d-c"]);
  await button(page, "Undo").click();
  await expect.poll(() => childIds(page, "d-s1")).toEqual(["d-c", "d-a", "d-b"]);
  await button(page, "Redo").click();
  await expect.poll(() => childIds(page, "d-s1")).toEqual(["d-a", "d-b", "d-c"]);
});

test("2: clicking a row (or its handle) still only selects; a drag of an unselected row selects it; BC-12.4: a selected row of a multi-selection drags the whole selection and keeps it", async ({ page }) => {
  await open(page);
  await rowById(page, "d-a").click();
  await rowById(page, "d-h").click({ modifiers: ["ControlOrMeta"] });
  await expect(page.locator("[data-structure-selection-count]")).toHaveText("2 selected");
  await rowById(page, "d-b").hover();
  await handleOf(page, "d-b").click();
  await expect(rowById(page, "d-b")).toHaveAttribute("aria-selected", "true");
  await expect(button(page, "Undo")).toBeDisabled();

  await rowById(page, "d-a").click();
  await rowById(page, "d-h").click({ modifiers: ["ControlOrMeta"] });
  await pickUp(page, "d-a");
  await expect(rowById(page, "d-h")).toHaveAttribute("aria-selected", "true"); // the selection is kept while dragging
  await hoverZone(page, "d-c", "after");
  await page.mouse.up();
  // BC-12.4 (superseding BC-12.3's single-row rule): Title and Alpha move together, in document order.
  await expect.poll(() => childIds(page, "d-s1")).toEqual(["d-b", "d-c", "d-h", "d-a"]);
  await expect.poll(() => childIds(page, "page-root")).toEqual(["d-s1", "d-s2", "d-list", "d-free"]);
  await expect(rowById(page, "d-a")).toHaveAttribute("aria-selected", "true");
  // BC-12.3.1: the rest of the selection survives the drop.
  await expect(rowById(page, "d-h")).toHaveAttribute("aria-selected", "true");
  await expect(page.locator("[data-structure-selection-count]")).toHaveText("2 selected");
});

test("3: a refused target shows the blocked indicator and the shared reason; dropping changes nothing, no Undo, and shows the notice", async ({ page }) => {
  await open(page);
  await pickUp(page, "d-a");
  await hoverZone(page, "d-list", "inside");
  await expect(indicator(page)).toHaveAttribute("data-refused", "true");
  await expect(page.locator("[data-structure-drop-reason]")).toHaveText("That place can't contain this kind of element");
  await expect(button(page, "Undo")).toBeDisabled(); // hovering never writes
  await page.mouse.up();
  await expect(page.locator("div[role=status]", { hasText: "Alpha wasn't moved: that place can't contain this kind of element." })).toBeVisible();
  await expect(button(page, "Undo")).toBeDisabled();
  await expect.poll(() => childIds(page, "d-s1")).toEqual(["d-a", "d-b", "d-c"]);
  await expect(indicator(page)).toHaveCount(0);

  // Into its own descendant.
  await pickUp(page, "d-s2");
  await hoverZone(page, "d-inner", "inside");
  await expect(page.locator("[data-structure-drop-reason]")).toHaveText("An element can't be moved into its own contents");
  await page.mouse.up();
  await expect(button(page, "Undo")).toBeDisabled();

  // A no-op drop (Alpha after Title's next sibling position = where it is) changes nothing either.
  await drag(page, "d-b", "d-a", "after");
  await expect(announcement(page)).toHaveText(/^Beta was not moved: it is already there\.\s*$/);
  await expect(button(page, "Undo")).toBeDisabled();
});

test("4: a collapsed container opens after a short hover on its inside zone; crossing it quickly does not; Escape cancels", async ({ page }) => {
  await open(page);
  await rowById(page, "d-inner").getByRole("button", { name: "Expand Inner box" }).waitFor({ state: "attached" });
  await expect(rowById(page, "d-inner")).toHaveAttribute("aria-expanded", "false");

  // Quick crossing: no expansion.
  await pickUp(page, "d-a");
  await hoverZone(page, "d-inner", "inside");
  await hoverZone(page, "d-list", "after");
  await page.waitForTimeout(800);
  await expect(rowById(page, "d-inner")).toHaveAttribute("aria-expanded", "false");

  // Rest on it: it opens and its revealed child becomes a target.
  await hoverZone(page, "d-inner", "inside");
  await expect(rowById(page, "d-inner")).toHaveAttribute("aria-expanded", "true", { timeout: 2000 });
  await expect(button(page, "Undo")).toBeDisabled();
  await hoverZone(page, "d-deep", "before");
  await expect(indicator(page)).toHaveAttribute("data-structure-drop-indicator", "before");
  await page.keyboard.press("Escape");
  await expect(indicator(page)).toHaveCount(0);
  await expect(page.locator("[data-structure-drag-preview]")).toHaveCount(0);
  await expect(announcement(page)).toHaveText(/^Move cancelled\. Alpha was not moved\.\s*$/);
  await page.mouse.up();
  await expect.poll(() => childIds(page, "d-s1")).toEqual(["d-a", "d-b", "d-c"]);
  await expect(button(page, "Undo")).toBeDisabled();
  await expect(rowById(page, "d-inner")).toHaveAttribute("aria-expanded", "true"); // unrelated state kept

  // Dropping outside the tree is a cancellation too.
  await pickUp(page, "d-a");
  const canvas = (await element(page, "d-free").boundingBox())!;
  await page.mouse.move(canvas.x + 50, canvas.y + 50, { steps: 6 });
  await expect(indicator(page)).toHaveCount(0);
  await page.mouse.up();
  await expect(button(page, "Undo")).toBeDisabled();
});

test("5: Flow → Free and Free → Flow; Preview and Export follow the dropped order", async ({ page }) => {
  await open(page);
  await drag(page, "d-b", "d-free", "inside");
  await expect(page.locator(`${SURFACE} [data-node-id="d-free"] > [data-node-id="d-b"]`)).toHaveCount(1);
  await expect(element(page, "d-b")).toHaveCSS("position", "absolute");
  const moved = (await element(page, "d-b").boundingBox())!;
  const container = (await element(page, "d-free").boundingBox())!;
  expect(moved.x).toBeGreaterThanOrEqual(container.x);
  expect(moved.y + moved.height).toBeLessThanOrEqual(container.y + container.height + 0.5);

  await drag(page, "d-b", "d-c", "after");
  await expect.poll(() => childIds(page, "d-s1")).toEqual(["d-a", "d-c", "d-b"]);
  await expect(element(page, "d-b")).not.toHaveCSS("position", "absolute");

  await button(page, "Enter Preview").click();
  const ys = await Promise.all(["d-a", "d-c", "d-b"].map(async (id) => (await element(page, id).boundingBox())!.y));
  expect(ys[0]).toBeLessThan(ys[1]);
  expect(ys[1]).toBeLessThan(ys[2]);
  await button(page, "Exit Preview").click();
  await page.getByRole("button", { name: "Export Code" }).click();
  const code = (await page.getByRole("dialog", { name: "Export Code" }).getByTestId("export-code").textContent()) ?? "";
  await page.keyboard.press("Escape");
  expect(code.indexOf(">Alpha<")).toBeLessThan(code.indexOf(">Gamma<"));
  expect(code.indexOf(">Gamma<")).toBeLessThan(code.indexOf(">Beta<"));
});

const bigTree = (count: number): EditorElementNode => ({
  id: "page-root",
  tag: "page",
  children: [
    { id: "b-top", tag: "section", displayName: "Top section", children: [p("b-mover", "Mover")] },
    { id: "b-list", tag: "section", displayName: "Long section", children: Array.from({ length: count }, (_, index) => p(`b-${index}`, `Row ${index}`)) },
  ],
});

test("6: edge auto-scroll scrolls only the Structure list, and a 1,000-row tree stays responsive", async ({ page }) => {
  await open(page, bigTree(1000), "b-999");
  const region = page.locator("[data-no-drag-autoscroll]", { has: page.locator("[data-structure-tree]") });
  const workspaceScroll = () => page.evaluate(() => [...document.querySelectorAll("*")].filter((el) => el.scrollTop > 0 && !el.querySelector("[data-structure-tree]")).length);
  expect(await region.evaluate((el) => el.scrollTop)).toBe(0);

  await pickUp(page, "b-mover");
  const box = (await region.boundingBox())!;
  // Rest near the bottom edge of the list: it scrolls down.
  await page.mouse.move(box.x + box.width / 2, box.y + box.height - 6, { steps: 8 });
  await expect.poll(() => region.evaluate((el) => el.scrollTop), { timeout: 5000 }).toBeGreaterThan(400);
  // Back to the middle: scrolling stops.
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 4 });
  const stopped = await region.evaluate((el) => el.scrollTop);
  await page.waitForTimeout(400);
  expect(Math.abs((await region.evaluate((el) => el.scrollTop)) - stopped)).toBeLessThan(40);
  expect(await workspaceScroll()).toBe(0);

  // Hover responsiveness over the large tree: 40 pointer moves across rows.
  const started = await page.evaluate(() => performance.now());
  for (let step = 0; step < 40; step++) await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + (step % 10) * 8);
  const hoverMs = (await page.evaluate(() => performance.now())) - started;
  console.log(`[BC-12.3 perf] 40 hover moves over a 1,002-row tree: ${Math.round(hoverMs)} ms`);

  // Drop: back up to the top edge until the Top section's row is visible, then drop after Row 0.
  await page.mouse.move(box.x + box.width / 2, box.y + 4, { steps: 4 });
  await expect.poll(() => region.evaluate((el) => el.scrollTop), { timeout: 8000 }).toBeLessThan(10);
  await hoverZone(page, "b-0", "after");
  const dropStarted = await page.evaluate(() => performance.now());
  await page.mouse.up();
  await expect.poll(() => childIds(page, "b-list").then((ids) => ids.slice(0, 2))).toEqual(["b-0", "b-mover"]);
  console.log(`[BC-12.3 perf] drop commit + re-render: ${Math.round((await page.evaluate(() => performance.now())) - dropStarted)} ms`);
});

test("7: touch (press and hold on the handle) and pen drags move a row; a quick touch swipe on the handle does not drag", async ({ browser }) => {
  const context = await browser.newContext({ hasTouch: true });
  const page = await context.newPage();
  await open(page);
  const cdp = await context.newCDPSession(page);
  const centre = async (id: string) => {
    const box = (await handleOf(page, id).boundingBox())!;
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  };
  const touch = (type: "touchStart" | "touchMove" | "touchEnd", x: number, y: number) =>
    cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y }] });

  // Quick swipe (no hold): no drag, nothing moves.
  let start = await centre("d-c");
  let target = await zonePoint(page, "d-a", "before");
  await touch("touchStart", start.x, start.y);
  for (let step = 1; step <= 6; step++) await touch("touchMove", start.x, start.y + ((target.y - start.y) * step) / 6);
  await touch("touchEnd", target.x, target.y);
  await expect.poll(() => childIds(page, "d-s1")).toEqual(["d-a", "d-b", "d-c"]);

  // Press and hold, then move: Gamma goes before Alpha.
  start = await centre("d-c");
  target = await zonePoint(page, "d-a", "before");
  await touch("touchStart", start.x, start.y);
  await page.waitForTimeout(350);
  for (let step = 1; step <= 8; step++) await touch("touchMove", start.x, start.y + ((target.y - start.y) * step) / 8);
  await expect(indicator(page)).toHaveAttribute("data-structure-drop-indicator", "before");
  await touch("touchEnd", target.x, target.y);
  await expect.poll(() => childIds(page, "d-s1")).toEqual(["d-c", "d-a", "d-b"]);
  await expect(page.locator("[data-structure-drag-preview]")).toHaveCount(0);

  // Pen: a direct drag (no hold), Beta after Gamma's new neighbour Alpha → [c, b, a]? Beta before Alpha.
  const pen = (type: "mousePressed" | "mouseMoved" | "mouseReleased", x: number, y: number) =>
    cdp.send("Input.dispatchMouseEvent", { type, x, y, button: "left", buttons: type === "mouseReleased" ? 0 : 1, clickCount: 1, pointerType: "pen" });
  start = await centre("d-b");
  target = await zonePoint(page, "d-a", "before");
  await pen("mouseMoved", start.x, start.y);
  await pen("mousePressed", start.x, start.y);
  for (let step = 1; step <= 8; step++) await pen("mouseMoved", start.x, start.y + ((target.y - start.y) * step) / 8);
  await expect(indicator(page)).toHaveAttribute("data-structure-drop-indicator", "before");
  await pen("mouseReleased", target.x, target.y);
  await expect.poll(() => childIds(page, "d-s1")).toEqual(["d-c", "d-b", "d-a"]);
  await context.close();
});

test("8: with reduced motion, auto-expand opens without animation and the drag still works", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await open(page);
  const group = rowById(page, "d-inner").locator("xpath=following-sibling::div[1]");
  // The global reduced-motion rule shortens every transition to ~0 (0.00001s).
  expect(Number.parseFloat(await group.evaluate((el) => getComputedStyle(el).transitionDuration))).toBeLessThan(0.01);
  await drag(page, "d-a", "d-s2", "inside");
  await expect.poll(() => childIds(page, "d-s2")).toEqual(["d-inner", "d-a"]);
  await pickUp(page, "d-b");
  await hoverZone(page, "d-inner", "inside");
  await expect(rowById(page, "d-inner")).toHaveAttribute("aria-expanded", "true", { timeout: 2000 });
  await page.mouse.up();
  await expect.poll(() => childIds(page, "d-inner")).toEqual(["d-deep", "d-b"]);
});

/* ---------------- BC-12.3.1 ---------------- */

const selectionCount = (page: Page) => page.locator("[data-structure-selection-count]");

test("9 (BC-12.3.1, updated for BC-12.4): dragging a row of a multi-selection keeps A, B and C selected — on drop, cancel, refusal and Undo/Redo", async ({ page }) => {
  await open(page);
  await rowById(page, "d-a").click();
  await rowById(page, "d-c").click({ modifiers: ["Shift"] });
  await expect(selectionCount(page)).toHaveText("3 selected");

  // BC-12.4: dragging B moves the whole selection (A, B, C) before the Title.
  await drag(page, "d-b", "d-h", "before");
  await expect.poll(() => childIds(page, "page-root")).toEqual(["d-a", "d-b", "d-c", "d-h", "d-s1", "d-s2", "d-list", "d-free"]);
  await expect(selectionCount(page)).toHaveText("3 selected");
  for (const id of ["d-a", "d-b", "d-c"]) await expect(rowById(page, id)).toHaveAttribute("aria-selected", "true");
  await expect(rowById(page, "d-b")).toBeFocused();

  await button(page, "Undo").click();
  await expect.poll(() => childIds(page, "d-s1")).toEqual(["d-a", "d-b", "d-c"]);
  await expect(selectionCount(page)).toHaveText("3 selected");
  await button(page, "Redo").click();
  await expect.poll(() => childIds(page, "d-s1")).toEqual([]);
  await expect(selectionCount(page)).toHaveText("3 selected");

  // Cancel (Escape) and a refused drop leave the selection and the document alone.
  await pickUp(page, "d-c");
  await hoverZone(page, "d-h", "before");
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await expect(selectionCount(page)).toHaveText("3 selected");
  await pickUp(page, "d-c");
  await hoverZone(page, "d-list", "inside");
  await expect(indicator(page)).toHaveAttribute("data-refused", "true");
  await page.mouse.up();
  await expect(selectionCount(page)).toHaveText("3 selected");
  await expect.poll(() => childIds(page, "page-root")).toEqual(["d-a", "d-b", "d-c", "d-h", "d-s1", "d-s2", "d-list", "d-free"]);

  // An unselected row follows plain selection: it becomes the only selection and moves alone.
  await drag(page, "d-h", "d-free", "before");
  await expect.poll(() => childIds(page, "page-root")).toEqual(["d-a", "d-b", "d-c", "d-s1", "d-s2", "d-list", "d-h", "d-free"]);
  await expect(rowById(page, "d-h")).toHaveAttribute("aria-selected", "true");
  await expect(rowById(page, "d-a")).toHaveAttribute("aria-selected", "false");
});

const trailingFixture: EditorElementNode = {
  id: "page-root",
  tag: "page",
  children: [
    { id: "t-s1", tag: "section", displayName: "Section A", children: [p("t-a", "Alpha"), p("t-b", "Beta")] },
    { id: "t-s2", tag: "section", displayName: "Section B", children: [{ id: "t-inner", tag: "div", displayName: "Inner", children: [p("t-deep", "Deep")] }] },
    { id: "t-list", tag: "ul", displayName: "List", children: [{ id: "t-li", tag: "li", text: "Item", displayName: "Item" }] },
    { id: "t-empty", tag: "div", displayName: "Empty box", children: [] },
    p("t-last", "Last"),
  ],
};

/** A point in the gap under `rowId`, at the indentation of `levelId`'s row (where its label starts). */
async function levelPoint(page: Page, rowId: string, levelId: string) {
  const row = (await rowById(page, rowId).boundingBox())!;
  const levelX = await rowById(page, levelId).evaluate((el) => el.getBoundingClientRect().left + Number.parseFloat(getComputedStyle(el).paddingLeft));
  return { x: levelX + 6, y: row.y + row.height * 0.9 };
}

test("10 (BC-12.3.1): end-of-container drops — after the final child at a chosen level, into an empty container, at the end of the page; refused and no-op appends; Undo/Redo; Preview/Export order", async ({ page }) => {
  await open(page, trailingFixture, "t-last");
  await rowById(page, "t-inner").getByRole("button", { name: "Expand Inner" }).click();
  await expect(rowById(page, "t-inner")).toHaveAttribute("aria-expanded", "true");

  // 1. Under "Deep" (the last row of Inner, itself the last of Section B), at Inner's
  //    indentation: the end of Section B — not the end of Inner, not after Section B.
  await pickUp(page, "t-a");
  let point = await levelPoint(page, "t-deep", "t-inner");
  await page.mouse.move(point.x, point.y, { steps: 6 });
  await expect(indicator(page)).toHaveAttribute("data-structure-drop-indicator", "after");
  const line = (await indicator(page).locator("div").first().boundingBox())!;
  const innerLabel = await rowById(page, "t-inner").evaluate((el) => el.getBoundingClientRect().left + Number.parseFloat(getComputedStyle(el).paddingLeft) + 20);
  expect(Math.abs(line.x - innerLabel)).toBeLessThan(2); // the line starts at the level it lands at
  await page.mouse.up();
  await expect.poll(() => childIds(page, "t-s2")).toEqual(["t-inner", "t-a"]);
  await expect.poll(() => childIds(page, "t-inner")).toEqual(["t-deep"]);

  // The same gap at Deep's own indentation: the end of Inner.
  await pickUp(page, "t-b");
  point = await levelPoint(page, "t-deep", "t-deep");
  await page.mouse.move(point.x + 40, point.y, { steps: 6 });
  await page.mouse.up();
  await expect.poll(() => childIds(page, "t-inner")).toEqual(["t-deep", "t-b"]);

  // 2. Into an empty container.
  await drag(page, "t-b", "t-empty", "inside");
  await expect.poll(() => childIds(page, "t-empty")).toEqual(["t-b"]);

  // 3. The end of the page: the drop area under the last row (shown only while dragging).
  const pageEnd = page.locator("[data-structure-page-end-drop]");
  await expect(pageEnd).toHaveCount(0);
  await pickUp(page, "t-a");
  await expect(pageEnd).toBeVisible();
  let area = (await pageEnd.boundingBox())!;
  await page.mouse.move(area.x + area.width / 2, area.y + area.height / 2, { steps: 6 });
  await expect(indicator(page)).toHaveAttribute("data-structure-drop-indicator", "inside");
  await expect(indicator(page)).not.toHaveAttribute("data-refused", "true");
  await page.mouse.up();
  await expect.poll(() => childIds(page, "page-root").then((ids) => ids.at(-1))).toBe("t-a");
  await expect(pageEnd).toHaveCount(0);

  // 4. Refused: a list item can't go to the page itself.
  const before = await childIds(page, "page-root");
  await pickUp(page, "t-li");
  area = (await pageEnd.boundingBox())!;
  await page.mouse.move(area.x + area.width / 2, area.y + area.height / 2, { steps: 6 });
  await expect(indicator(page)).toHaveAttribute("data-refused", "true");
  await expect(page.locator("[data-structure-drop-reason]")).toHaveText("That place can't contain this kind of element");
  await page.mouse.up();
  expect(await childIds(page, "page-root")).toEqual(before);

  // 6. Undo/Redo of the page-end append.
  await button(page, "Undo").click();
  await expect.poll(() => childIds(page, "t-s2")).toEqual(["t-inner", "t-a"]);
  await button(page, "Redo").click();
  await expect.poll(() => childIds(page, "page-root").then((ids) => ids.at(-1))).toBe("t-a");

  // 5. No-op: the page's last child appended to the page again — no history.
  await pickUp(page, "t-a");
  area = (await pageEnd.boundingBox())!;
  await page.mouse.move(area.x + area.width / 2, area.y + area.height / 2, { steps: 6 });
  await page.mouse.up();
  await expect(announcement(page)).toHaveText(/^Alpha was not moved: it is already there\.\s*$/);
  // No history entry: the next Undo still undoes the page-end append itself.
  await button(page, "Undo").click();
  await expect.poll(() => childIds(page, "t-s2")).toEqual(["t-inner", "t-a"]);
  await button(page, "Redo").click();

  // 7. Canvas / Preview / Export order.
  await button(page, "Enter Preview").click();
  const lastY = (await element(page, "t-last").boundingBox())!.y;
  expect((await element(page, "t-a").boundingBox())!.y).toBeGreaterThan(lastY);
  await button(page, "Exit Preview").click();
  await page.getByRole("button", { name: "Export Code" }).click();
  const code = (await page.getByRole("dialog", { name: "Export Code" }).getByTestId("export-code").textContent()) ?? "";
  await page.keyboard.press("Escape");
  expect(code.indexOf(">Last<")).toBeLessThan(code.indexOf(">Alpha<"));
  expect(code.indexOf(">Deep<")).toBeLessThan(code.indexOf(">Last<"));
});

/* ---------------- BC-12.4: multi-element drag ---------------- */

const chip = (page: Page) => page.locator("[data-structure-drag-preview]");

async function selectRows(page: Page, ids: string[]) {
  // dnd-kit swallows clicks for 50 ms after a drop (its post-drag click guard); a user never clicks that fast.
  await page.waitForTimeout(80);
  await rowById(page, ids[0]).click();
  for (const id of ids.slice(1)) await rowById(page, id).click({ modifiers: ["ControlOrMeta"] });
}

test("11 (BC-12.4): multi-drag — siblings together, across containers, parent + child as one root, an invalid batch refused whole, Escape; one Undo step each", async ({ page }) => {
  await open(page);

  // Two siblings, dragged by the later one: both move, in document order, after Beta.
  await selectRows(page, ["d-a", "d-c"]);
  await pickUp(page, "d-c");
  await expect(chip(page)).toHaveText(/Gamma\s*\+ 1 element/);
  await expect(announcement(page)).toHaveText(/^Dragging Gamma and 1 other element \(2 in all\)\./);
  await hoverZone(page, "d-b", "after");
  await expect(indicator(page)).toHaveAttribute("data-structure-drop-indicator", "after");
  await expect(indicator(page)).not.toHaveAttribute("data-refused", "true");
  await page.mouse.up();
  await expect.poll(() => childIds(page, "d-s1")).toEqual(["d-b", "d-a", "d-c"]);
  await expect(announcement(page)).toHaveText(/^Moved 2 elements to Section One, positions 2–3 of 3\.\s*$/);
  await expect(selectionCount(page)).toHaveText("2 selected");
  await expect(rowById(page, "d-c")).toBeFocused();
  await button(page, "Undo").click();
  await expect.poll(() => childIds(page, "d-s1")).toEqual(["d-a", "d-b", "d-c"]);
  await expect(button(page, "Undo")).toBeDisabled(); // exactly one history step

  // Across containers: Alpha (Section One) + Inner box (Section Two) before the List.
  await selectRows(page, ["d-inner", "d-a"]);
  await drag(page, "d-a", "d-list", "before");
  await expect.poll(() => childIds(page, "page-root")).toEqual(["d-h", "d-s1", "d-s2", "d-a", "d-inner", "d-list", "d-free"]);
  await expect.poll(() => childIds(page, "d-s2")).toEqual([]);
  await expect.poll(() => childIds(page, "d-inner")).toEqual(["d-deep"]); // the subtree travelled intact
  await button(page, "Undo").click();
  await expect.poll(() => childIds(page, "d-s2")).toEqual(["d-inner"]);

  // Parent + child selected: the child travels inside its parent (one root), the chip names what moves.
  await selectRows(page, ["d-s1", "d-b"]);
  await pickUp(page, "d-b");
  await expect(chip(page)).toHaveText(/^\s*Section One\s*$/);
  await hoverZone(page, "d-list", "before");
  await page.mouse.up();
  await expect.poll(() => childIds(page, "page-root")).toEqual(["d-h", "d-s2", "d-s1", "d-list", "d-free"]);
  await expect.poll(() => childIds(page, "d-s1")).toEqual(["d-a", "d-b", "d-c"]);
  await expect(selectionCount(page)).toHaveText("2 selected");
  await button(page, "Undo").click();

  // An invalid batch (a List item cannot go into a Section) is refused as a whole.
  await selectRows(page, ["d-a", "d-li"]);
  await pickUp(page, "d-a");
  await hoverZone(page, "d-s2", "inside");
  await expect(indicator(page)).toHaveAttribute("data-refused", "true");
  await expect(page.locator("[data-structure-drop-reason]")).toHaveText("That place can't contain this kind of element");
  await page.mouse.up();
  await expect(page.locator("div[role=status]", { hasText: "The 2 elements weren't moved: that place can't contain this kind of element." })).toBeVisible();
  await expect.poll(() => childIds(page, "d-s1")).toEqual(["d-a", "d-b", "d-c"]);
  await expect(selectionCount(page)).toHaveText("2 selected");
  await expect(button(page, "Undo")).toBeDisabled();

  // Escape cancels a multi-drag and keeps the selection.
  await selectRows(page, ["d-a", "d-c"]);
  await pickUp(page, "d-a");
  await hoverZone(page, "d-h", "before");
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await expect(announcement(page)).toHaveText(/^Move cancelled\. The 2 elements were not moved\.\s*$/);
  await expect(selectionCount(page)).toHaveText("2 selected");
  await expect(chip(page)).toHaveCount(0);
  await expect(button(page, "Undo")).toBeDisabled();

  // Alt+Arrow stays a single-element move even with a multi-selection.
  await rowById(page, "d-a").focus();
  await page.keyboard.press("Alt+ArrowDown");
  await expect.poll(() => childIds(page, "d-s1")).toEqual(["d-b", "d-a", "d-c"]);
});

const batchFixture: EditorElementNode = {
  id: "page-root",
  tag: "page",
  children: [
    { id: "m-nav", tag: "nav", displayName: "Navbar", children: Array.from({ length: 11 }, (_, index) => ({ id: `m-n${index}`, tag: "a", text: `Link ${index}`, href: "#", displayName: `Link ${index}` })) },
    {
      id: "m-box",
      tag: "div",
      displayName: "Spare links",
      children: [
        { id: "m-e0", tag: "a", text: "Extra 0", href: "#", displayName: "Extra 0" },
        { id: "m-e1", tag: "a", text: "Extra 1", href: "#", displayName: "Extra 1" },
      ],
    },
    { id: "m-flow", tag: "div", displayName: "Flow box", children: [p("m-p1", "First"), p("m-p2", "Second")] },
    { id: "m-free", tag: "div", displayName: "Free box", layoutMode: "free", dimensions: { preferredWidth: 600, preferredHeight: 300, offsetX: 0, offsetY: 0 }, children: [] },
  ],
};

test("12 (BC-12.4): Navbar final capacity, a batch into a Free container, Save/Reopen and Preview/Export order", async ({ page }) => {
  await open(page, batchFixture, "m-free");

  // 11 links + 2 = 13: refused as a batch.
  await selectRows(page, ["m-e0", "m-e1"]);
  await pickUp(page, "m-e0");
  await hoverZone(page, "m-n5", "after");
  await expect(page.locator("[data-structure-drop-reason]")).toHaveText("A navigation bar can have at most 12 links");
  await page.mouse.up();
  await expect.poll(() => childIds(page, "m-nav").then((ids) => ids.length)).toBe(11);
  await expect(button(page, "Undo")).toBeDisabled();

  // Two Flow paragraphs into the Free box: both positioned inside it, not on top of each other.
  // (The Navbar is collapsed first so the Free box row is not in the list's bottom auto-scroll band.)
  await rowById(page, "m-nav").getByRole("button", { name: "Collapse Navbar" }).click();
  await selectRows(page, ["m-p1", "m-p2"]);
  await drag(page, "m-p2", "m-free", "inside");
  await expect.poll(() => childIds(page, "m-free")).toEqual(["m-p1", "m-p2"]);
  const container = (await element(page, "m-free").boundingBox())!;
  const [one, two] = await Promise.all([element(page, "m-p1").boundingBox(), element(page, "m-p2").boundingBox()]);
  for (const box of [one!, two!]) {
    expect(box.x).toBeGreaterThanOrEqual(container.x - 0.5);
    expect(box.y).toBeGreaterThanOrEqual(container.y - 0.5);
    expect(box.x + box.width).toBeLessThanOrEqual(container.x + container.width + 0.5);
    expect(box.y + box.height).toBeLessThanOrEqual(container.y + container.height + 0.5);
  }
  expect(two!.y).toBeGreaterThan(one!.y);
  await expect(element(page, "m-p1")).toHaveCSS("position", "absolute");

  // Save, reload, reopen: the moved arrangement is kept.
  await page.keyboard.press("ControlOrMeta+s");
  const save = page.getByRole("dialog", { name: "Save Project" });
  await expect(page.locator('[data-project-status="saved"]').or(save)).toBeVisible();
  if (await save.isVisible()) {
    await save.getByRole("textbox", { name: "Project name" }).fill("BC-12.4 multi-drag");
    await save.getByRole("button", { name: "Save" }).click();
  }
  await expect(page.locator("[data-project-status]")).toHaveAttribute("data-project-status", "saved");
  await page.reload();
  await gotoApp(page);
  await page.keyboard.press("ControlOrMeta+o");
  const library = page.getByRole("dialog", { name: "Open Project" });
  await library.getByRole("button", { name: /^Open (BC-02\.5 parity|BC-12\.4 multi-drag)$/ }).first().click();
  await expect(library).toBeHidden();
  await expect.poll(() => childIds(page, "m-free")).toEqual(["m-p1", "m-p2"]);
  await expect.poll(() => childIds(page, "m-flow")).toEqual([]);

  await button(page, "Enter Preview").click();
  await expect(element(page, "m-p2")).toHaveCSS("position", "absolute");
  await button(page, "Exit Preview").click();
  await page.getByRole("button", { name: "Export Code" }).click();
  const code = (await page.getByRole("dialog", { name: "Export Code" }).getByTestId("export-code").textContent()) ?? "";
  await page.keyboard.press("Escape");
  expect(code.indexOf(">First<")).toBeGreaterThan(-1);
  expect(code.indexOf(">First<")).toBeLessThan(code.indexOf(">Second<"));
});
