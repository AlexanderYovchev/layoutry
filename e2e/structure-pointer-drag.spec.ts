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

test("2: clicking a row (or its handle) still only selects; a drag of an unselected row selects it; multi-selection drags only that row", async ({ page }) => {
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
  await expect.poll(() => childIds(page, "d-s1")).toEqual(["d-b", "d-c", "d-a"]);
  await expect.poll(() => childIds(page, "page-root")).toEqual(["d-h", "d-s1", "d-s2", "d-list", "d-free"]);
  await expect(rowById(page, "d-a")).toHaveAttribute("aria-selected", "true");
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
