import { expect, test, type Page } from "@playwright/test";
import { gotoApp } from "./support/gotoApp";
import { importDocument } from "./support/parityFixtures";
import { installDeclaredStyle } from "./support/declaredStyle";
import type { EditorElementNode } from "../src/features/editor/types/document";

// BC-17.3: stored geometry lives in the generated document sheet, not inline (see support/declaredStyle.ts).
test.beforeEach(({ page }) => installDeclaredStyle(page));

/*
 * BC-13.5 — the Free drag/resize lifecycle in a real browser: Escape (drag,
 * resize, Canvas Flow drag) keeps the selection and records nothing;
 * edge auto-scroll of the Workspace and of nested scroll containers with
 * the element kept under the pointer; it stops on release, on Escape and at
 * the boundary; snap targets scrolled into view become usable; Delete
 * mid-drag; a SIMULATED pointercancel (a synthetic event, not a device).
 * BC-13.5.1: the Option B keyboard policy, redo preservation, and auto-scroll
 * during resizing.
 */

const SURFACE = "[data-document-surface]";
const node = (page: Page, id: string) => page.locator(`${SURFACE} [data-node-id="${id}"]`);
const tree = (page: Page) => page.getByRole("tree", { name: "Page structure" });
const row = (page: Page, name: string) => tree(page).getByRole("treeitem", { name: new RegExp(`^(Collapse |Expand )?${name}`) }).first();
const button = (page: Page, name: string) => page.getByRole("button", { name, exact: true });
const workspaceScroll = (page: Page) => page.locator('main[aria-label="Workspace"]').evaluate((el) => ({ top: el.scrollTop, left: el.scrollLeft }));
const scrollOf = (page: Page, id: string) => node(page, id).evaluate((el) => ({ left: el.scrollLeft, top: el.scrollTop, maxLeft: el.scrollWidth - el.clientWidth, maxTop: el.scrollHeight - el.clientHeight }));
const verticalGuide = (page: Page) => page.locator('[data-canvas-overlay="snap-guide-horizontal"]');

const p = (id: string, x: number, y: number, width: number, height: number, color: string): EditorElementNode => ({
  id,
  tag: "p",
  text: id,
  displayName: id,
  freeLayout: { x, y, width, height },
  background: { color },
});
const flexChild = { grow: 0, shrink: 0, basis: 400, alignSelf: "auto" as const };

const fixture: EditorElementNode = {
  id: "page-root",
  tag: "page",
  children: [
    { id: "flow", tag: "div", displayName: "FlowBox", children: [{ id: "flowp", tag: "p", text: "Flow paragraph", displayName: "FlowPara" }] },
    {
      id: "free",
      tag: "div",
      layoutMode: "free",
      displayName: "Tall",
      dimensions: { preferredWidth: 600, preferredHeight: 1500, offsetX: 0, offsetY: 0 },
      children: [p("mover", 60, 60, 100, 40, "#3b82f6"), p("deep", 300, 1100, 120, 40, "#ef4444"), { ...p("ratio", 300, 200, 80, 40, "#a855f7"), aspectRatioLocked: true }],
    },
    {
      id: "hscroller",
      tag: "div",
      displayName: "HScroller",
      display: { overflow: "auto" },
      dimensions: { preferredWidth: 320, preferredHeight: 220, offsetX: 0, offsetY: 0 },
      flowLayout: { display: "flex", flex: { direction: "row", wrap: "nowrap", justifyContent: "start", alignItems: "stretch", rowGap: 0, columnGap: 0 } },
      children: [
        { id: "hinner", tag: "div", layoutMode: "free", displayName: "HInner", flexChild, children: [p("h", 20, 20, 60, 30, "#22c55e")] },
        { id: "hfill", tag: "p", text: "fill", displayName: "HFill", flexChild },
      ],
    },
  ],
};

async function open(page: Page) {
  await gotoApp(page);
  await importDocument(page, fixture, "mover");
  await page.getByRole("tab", { name: "Structure" }).click(); // selection is read from the Structure rows
}

/** Presses on an element (offset from its top-left) and returns the pointer position; the button stays down. */
async function press(page: Page, id: string, dx = 20, dy = 20) {
  const r = (await node(page, id).boundingBox())!;
  const point = { x: r.x + dx, y: r.y + dy };
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  return { rect: r, point };
}

test("Escape during a Free drag restores the exact position, keeps the selection, and records nothing", async ({ page }) => {
  await open(page);
  await node(page, "mover").click();
  await expect(row(page, "mover")).toHaveAttribute("aria-selected", "true");
  const stored = await node(page, "mover").evaluate((el) => ({ left: window.__lyDeclaredStyle(el).left, top: window.__lyDeclaredStyle(el).top }));
  const { rect, point } = await press(page, "mover");
  await page.mouse.move(point.x + 90, point.y + 70, { steps: 8 });
  await expect.poll(async () => (await node(page, "mover").boundingBox())!.x).toBeGreaterThan(rect.x + 60);
  await page.keyboard.press("Escape");
  await page.mouse.up();
  expect(await node(page, "mover").evaluate((el) => ({ left: window.__lyDeclaredStyle(el).left, top: window.__lyDeclaredStyle(el).top }))).toEqual(stored); // the exact stored position
  await expect(row(page, "mover")).toHaveAttribute("aria-selected", "true");
  await expect(button(page, "Undo")).toBeDisabled();
});

test("Escape during a resize restores the size and keeps the selection", async ({ page }) => {
  await open(page);
  await node(page, "mover").click();
  const start = (await node(page, "mover").boundingBox())!;
  const handle = (await page.locator('[data-resize-handle="e"]').boundingBox())!;
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
  await page.mouse.down();
  await page.mouse.move(handle.x + 80, handle.y + handle.height / 2, { steps: 6 });
  await expect.poll(async () => (await node(page, "mover").boundingBox())!.width).toBeGreaterThan(start.width + 40);
  await page.keyboard.press("Escape");
  await page.mouse.up();
  expect((await node(page, "mover").boundingBox())!.width).toBeCloseTo(start.width, 1);
  await expect(row(page, "mover")).toHaveAttribute("aria-selected", "true");
  await expect(button(page, "Undo")).toBeDisabled();
});

test("Escape during a Canvas (Flow) drag cancels it without clearing the selection (the BC-12 defect)", async ({ page }) => {
  await open(page);
  await node(page, "flowp").click();
  await expect(row(page, "FlowPara")).toHaveAttribute("aria-selected", "true");
  const r = (await node(page, "flowp").boundingBox())!;
  await page.mouse.move(r.x + 10, r.y + r.height / 2);
  await page.mouse.down();
  await page.mouse.move(r.x + 40, r.y + r.height / 2 + 30, { steps: 6 });
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await expect(row(page, "FlowPara")).toHaveAttribute("aria-selected", "true");
  await expect(page.locator(`${SURFACE} [data-node-id="flow"] [data-node-id="flowp"]`)).toHaveCount(1);
  await expect(button(page, "Undo")).toBeDisabled();
});

test("Workspace auto-scroll: holding near the bottom edge keeps scrolling with the element under the pointer; it stops on release; one Undo step", async ({ page }) => {
  await open(page);
  const workspace = (await page.locator('main[aria-label="Workspace"]').boundingBox())!;
  const { rect, point } = await press(page, "mover");
  const edgeY = workspace.y + workspace.height - 8;
  await page.mouse.move(point.x, edgeY, { steps: 10 });
  await page.waitForTimeout(700); // stationary pointer near the edge
  const scrolled = await workspaceScroll(page);
  expect(scrolled.top).toBeGreaterThan(40); // (WebKit renders fewer frames under parallel load)
  const held = (await node(page, "mover").boundingBox())!;
  expect(Math.abs(held.y - (edgeY - 20))).toBeLessThanOrEqual(4); // still under the pointer (grabbed 20px from its top), within one frame of scrolling
  await page.mouse.up();
  await page.waitForTimeout(400); // the release (its selection click, Firefox's async scroll) settles first
  const stopped = (await workspaceScroll(page)).top;
  await page.waitForTimeout(400);
  expect((await workspaceScroll(page)).top).toBe(stopped); // no auto-scroll after release

  await button(page, "Undo").click();
  await expect(button(page, "Undo")).toBeDisabled(); // exactly one entry
  await page.locator('main[aria-label="Workspace"]').evaluate((el) => (el.scrollTop = 0));
  await expect.poll(async () => Math.round((await node(page, "mover").boundingBox())!.y)).toBe(Math.round(rect.y));
});

test("Escape stops auto-scroll at once and restores the element; nothing is recorded", async ({ page }) => {
  await open(page);
  const workspace = (await page.locator('main[aria-label="Workspace"]').boundingBox())!;
  const before = await node(page, "mover").evaluate((el) => ({ left: window.__lyDeclaredStyle(el).left, top: window.__lyDeclaredStyle(el).top }));
  const { point } = await press(page, "mover");
  await page.mouse.move(point.x, workspace.y + workspace.height - 6, { steps: 8 });
  await page.waitForTimeout(400);
  await page.keyboard.press("Escape");
  const at = (await workspaceScroll(page)).top;
  expect(at).toBeGreaterThan(0);
  await page.waitForTimeout(300);
  expect((await workspaceScroll(page)).top).toBe(at);
  await page.mouse.up();
  expect(await node(page, "mover").evaluate((el) => ({ left: window.__lyDeclaredStyle(el).left, top: window.__lyDeclaredStyle(el).top }))).toEqual(before);
  await expect(button(page, "Undo")).toBeDisabled();
});

test("a snap target that was offscreen at pointer-down becomes usable once auto-scroll reveals it; the guide is on its rendered edge", async ({ page }) => {
  await open(page);
  const workspace = (await page.locator('main[aria-label="Workspace"]').boundingBox())!;
  const { point } = await press(page, "mover");
  await page.mouse.move(point.x, workspace.y + workspace.height - 4, { steps: 10 });
  await expect.poll(async () => (await node(page, "deep").boundingBox())!.y, { timeout: 8000 }).toBeLessThan(workspace.y + workspace.height - 80);
  await page.mouse.move(point.x, workspace.y + workspace.height / 2, { steps: 6 }); // out of the edge band: scrolling stops
  const deep = (await node(page, "deep").boundingBox())!;
  const mover = (await node(page, "mover").boundingBox())!;
  // Put the mover's top 3px below the deep element's top.
  await page.mouse.move(point.x, workspace.y + workspace.height / 2 + (deep.y + 3 - mover.y), { steps: 4 });
  await expect(verticalGuide(page)).toHaveAttribute("data-achieved", "true");
  const snapped = (await node(page, "mover").boundingBox())!;
  expect(snapped.y).toBeCloseTo((await node(page, "deep").boundingBox())!.y, 1);
  expect((await verticalGuide(page).boundingBox())!.y).toBeCloseTo((await node(page, "deep").boundingBox())!.y, 0);
  await page.mouse.up();
});

test("a nested horizontal scroller scrolls first (the Workspace doesn't), only until its Free container's far edge is in view, with the element kept under the pointer", async ({ page }) => {
  await open(page);
  await node(page, "hscroller").scrollIntoViewIfNeeded();
  const scroller = (await node(page, "hscroller").boundingBox())!;
  const wsBefore = await workspaceScroll(page);
  const { point } = await press(page, "h", 10, 10);
  await page.mouse.move(scroller.x + scroller.width - 6, point.y, { steps: 10 });
  await page.waitForTimeout(500);
  const mid = await scrollOf(page, "hscroller");
  expect(mid.left).toBeGreaterThan(20);
  expect((await workspaceScroll(page)).left).toBe(wsBefore.left);
  await page.waitForTimeout(1500); // long enough to reach the end of what's reachable
  const end = await scrollOf(page, "hscroller");
  await page.waitForTimeout(200);
  expect((await scrollOf(page, "hscroller")).left).toBe(end.left); // stopped
  expect(end.left).toBeLessThan(end.maxLeft); // not run on past the element's container (the filler beyond it)
  const visibleRight = await node(page, "hscroller").evaluate((el) => el.getBoundingClientRect().left + el.clientLeft + el.clientWidth);
  const inner = (await node(page, "hinner").boundingBox())!;
  expect(Math.abs(inner.x + inner.width - visibleRight)).toBeLessThanOrEqual(2); // its far edge just came into view
  const clamped = (await node(page, "h").boundingBox())!;
  expect(clamped.x + clamped.width).toBeLessThanOrEqual(inner.x + inner.width + 0.5); // still inside its container
  expect((await workspaceScroll(page)).left).toBe(wsBefore.left);
  await page.mouse.up();
  await expect.poll(async () => (await node(page, "h").boundingBox())!.x).toBeGreaterThan(scroller.x); // committed where it was released
});

test("Delete during a drag removes the element; Undo brings it back at its committed position (never the half-dragged one)", async ({ page }) => {
  await open(page);
  await node(page, "mover").click();
  const before = await node(page, "mover").evaluate((el) => ({ left: window.__lyDeclaredStyle(el).left, top: window.__lyDeclaredStyle(el).top }));
  const { point } = await press(page, "mover");
  await page.mouse.move(point.x + 120, point.y + 90, { steps: 8 });
  await page.keyboard.press("Delete");
  await page.mouse.move(point.x + 150, point.y + 100, { steps: 3 });
  await page.mouse.up();
  await expect(node(page, "mover")).toHaveCount(0);
  await button(page, "Undo").click();
  await expect(node(page, "mover")).toHaveCount(1);
  expect(await node(page, "mover").evaluate((el) => ({ left: window.__lyDeclaredStyle(el).left, top: window.__lyDeclaredStyle(el).top }))).toEqual(before);
  await expect(button(page, "Undo")).toBeDisabled();
});

test("a (simulated) pointercancel mid-drag rolls back instead of committing", async ({ page }) => {
  await open(page);
  const before = await node(page, "mover").evaluate((el) => ({ left: window.__lyDeclaredStyle(el).left, top: window.__lyDeclaredStyle(el).top }));
  const { point } = await press(page, "mover");
  await page.mouse.move(point.x + 100, point.y + 50, { steps: 8 });
  await expect.poll(async () => node(page, "mover").evaluate((el) => window.__lyDeclaredStyle(el).left)).not.toBe(before.left);
  await node(page, "mover").dispatchEvent("pointercancel", { pointerId: 1, bubbles: true, pointerType: "touch" });
  await page.mouse.up();
  expect(await node(page, "mover").evaluate((el) => ({ left: window.__lyDeclaredStyle(el).left, top: window.__lyDeclaredStyle(el).top }))).toEqual(before);
  await expect(button(page, "Undo")).toBeDisabled();
  await expect(page.locator('[data-canvas-overlay^="snap-guide"]')).toHaveCount(0);
});

/* ---------------- BC-13.5.1 ---------------- */

const stored = (page: Page, id: string) => node(page, id).evaluate((el) => ({ left: window.__lyDeclaredStyle(el).left, top: window.__lyDeclaredStyle(el).top, width: window.__lyDeclaredStyle(el).width, height: window.__lyDeclaredStyle(el).height }));
const px = (value: string) => Number.parseFloat(value);

/** Presses a resize handle of the selected element; the button stays down. */
async function pressHandle(page: Page, direction: string) {
  const r = (await page.locator(`[data-resize-handle="${direction}"]`).boundingBox())!;
  const point = { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  return point;
}

test("keyboard (Option B): unassigned keys and Ctrl alone don't cancel a drag; Ctrl+Z cancels it, then undoes the last COMMITTED edit once, and Redo still works", async ({ page }) => {
  await open(page);
  const original = await stored(page, "mover");
  // A committed drag first (history: one entry).
  let { point } = await press(page, "mover");
  await page.mouse.move(point.x + 50, point.y + 30, { steps: 5 });
  await page.mouse.up();
  const committed = await stored(page, "mover");
  expect(committed).not.toEqual(original);

  ({ point } = await press(page, "mover"));
  await page.mouse.move(point.x + 80, point.y + 40, { steps: 5 });
  for (const key of ["q", "5", ",", "Control"]) await page.keyboard.press(key);
  await page.mouse.move(point.x + 100, point.y + 40, { steps: 3 }); // still dragging
  await expect.poll(async () => px((await stored(page, "mover")).left)).toBeGreaterThan(px(committed.left) + 90);
  await page.keyboard.press("ControlOrMeta+z");
  await page.mouse.up();
  expect(await stored(page, "mover")).toEqual(original); // the drag rolled back, then the first drag undone
  await expect(button(page, "Undo")).toBeDisabled();
  await button(page, "Redo").click();
  expect(await stored(page, "mover")).toEqual(committed);
});

test("keyboard (Option B): Ctrl+S during a drag cancels it first; the save works on the committed position", async ({ page }) => {
  await open(page);
  const original = await stored(page, "mover");
  const { point } = await press(page, "mover");
  await page.mouse.move(point.x + 70, point.y + 70, { steps: 5 });
  await page.keyboard.press("ControlOrMeta+s");
  await page.mouse.up();
  expect(await stored(page, "mover")).toEqual(original);
  // The normal save flow ran (saved in place, or the first-save dialog) — on the committed position.
  await expect(page.locator('[data-project-status="saved"]').or(page.getByRole("dialog", { name: "Save Project" }))).toBeVisible();
  await expect(button(page, "Undo")).toBeDisabled();
});

test("redo survives an Escape-cancelled drag after several live frames, and Redo restores the committed state", async ({ page }) => {
  await open(page);
  let { point } = await press(page, "mover");
  await page.mouse.move(point.x + 60, point.y + 20, { steps: 5 });
  await page.mouse.up();
  const committed = await stored(page, "mover");
  await button(page, "Undo").click();
  await expect(button(page, "Redo")).toBeEnabled();
  ({ point } = await press(page, "mover"));
  await page.mouse.move(point.x + 120, point.y + 80, { steps: 10 });
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await expect(button(page, "Redo")).toBeEnabled();
  await button(page, "Redo").click();
  expect(await stored(page, "mover")).toEqual(committed);
});

test("resize auto-scroll (Workspace, south handle): a stationary pointer keeps scrolling, the bottom edge follows it, the top stays anchored; Escape restores exactly; a completed one is one Undo step", async ({ page }) => {
  await open(page);
  await node(page, "mover").click();
  const before = await stored(page, "mover");
  const workspace = (await page.locator('main[aria-label="Workspace"]').boundingBox())!;
  let point = await pressHandle(page, "s");
  const edgeY = workspace.y + workspace.height - 8;
  await page.mouse.move(point.x, edgeY, { steps: 8 });
  await page.waitForTimeout(700);
  expect((await workspaceScroll(page)).top).toBeGreaterThan(40);
  const live = await stored(page, "mover");
  expect(live.top).toBe(before.top); // opposite (top) edge anchored
  const box = (await node(page, "mover").boundingBox())!;
  expect(Math.abs(box.y + box.height - edgeY)).toBeLessThanOrEqual(4); // the active edge follows the pointer
  await page.keyboard.press("Escape");
  await page.mouse.up();
  expect(await stored(page, "mover")).toEqual(before);
  await expect(button(page, "Undo")).toBeDisabled();
  await expect(row(page, "mover")).toHaveAttribute("aria-selected", "true");

  await page.locator('main[aria-label="Workspace"]').evaluate((el) => (el.scrollTop = 0));
  point = await pressHandle(page, "s");
  await page.mouse.move(point.x, edgeY, { steps: 8 });
  await page.waitForTimeout(500);
  await page.mouse.up();
  const grown = await stored(page, "mover");
  expect(px(grown.height)).toBeGreaterThan(px(before.height) + 100);
  const free = (await node(page, "free").boundingBox())!;
  const moverBox = (await node(page, "mover").boundingBox())!;
  expect(moverBox.y + moverBox.height).toBeLessThanOrEqual(free.y + free.height + 0.5); // containment
  await button(page, "Undo").click();
  expect(await stored(page, "mover")).toEqual(before);
  await expect(button(page, "Undo")).toBeDisabled(); // exactly one entry
});

test("resize auto-scroll in a nested scroller (east handle): the scroller scrolls (not the Workspace), the left edge stays anchored, the right edge stays inside its container", async ({ page }) => {
  await open(page);
  await node(page, "hscroller").scrollIntoViewIfNeeded();
  await node(page, "h").click();
  const before = await stored(page, "h");
  const scroller = (await node(page, "hscroller").boundingBox())!;
  const wsBefore = await workspaceScroll(page);
  const point = await pressHandle(page, "e");
  await page.mouse.move(scroller.x + scroller.width - 6, point.y, { steps: 8 });
  await page.waitForTimeout(800);
  expect((await scrollOf(page, "hscroller")).left).toBeGreaterThan(20);
  expect((await workspaceScroll(page)).left).toBe(wsBefore.left);
  const live = await stored(page, "h");
  expect(live.left).toBe(before.left);
  expect(px(live.width)).toBeGreaterThan(px(before.width) + 20);
  const inner = (await node(page, "hinner").boundingBox())!;
  const box = (await node(page, "h").boundingBox())!;
  expect(box.x + box.width).toBeLessThanOrEqual(inner.x + inner.width + 0.5);
  await page.mouse.up();
  await button(page, "Undo").click();
  expect(await stored(page, "h")).toEqual(before);
});

test("resize auto-scroll on a ratio-locked corner keeps the ratio; a snap target revealed by the scroll gets an accurate guide", async ({ page }) => {
  await open(page);
  await node(page, "ratio").click();
  const start = (await node(page, "ratio").boundingBox())!;
  const workspace = (await page.locator('main[aria-label="Workspace"]').boundingBox())!;
  const point = await pressHandle(page, "se");
  await page.mouse.move(point.x + 30, workspace.y + workspace.height - 6, { steps: 8 });
  await page.waitForTimeout(500);
  const live = (await node(page, "ratio").boundingBox())!;
  expect(live.width / live.height).toBeCloseTo(start.width / start.height, 2);
  await page.mouse.up();
  await button(page, "Undo").click();

  // South resize of the mover down to the deep element's top edge (offscreen at pointer-down).
  await page.locator('main[aria-label="Workspace"]').evaluate((el) => (el.scrollTop = 0));
  await node(page, "mover").click();
  const s = await pressHandle(page, "s");
  await page.mouse.move(s.x, workspace.y + workspace.height - 4, { steps: 8 });
  await expect.poll(async () => (await node(page, "deep").boundingBox())!.y, { timeout: 8000 }).toBeLessThan(workspace.y + workspace.height - 80);
  await page.mouse.move(s.x, workspace.y + workspace.height / 2, { steps: 4 }); // out of the band
  const deep = (await node(page, "deep").boundingBox())!;
  const box = (await node(page, "mover").boundingBox())!;
  await page.mouse.move(s.x, workspace.y + workspace.height / 2 + (deep.y - 3 - (box.y + box.height)), { steps: 4 });
  await expect(verticalGuide(page)).toHaveAttribute("data-achieved", "true");
  const snapped = (await node(page, "mover").boundingBox())!;
  const deepNow = (await node(page, "deep").boundingBox())!;
  expect(snapped.y + snapped.height).toBeCloseTo(deepNow.y, 1);
  expect((await verticalGuide(page).boundingBox())!.y).toBeCloseTo(deepNow.y, 0);
  await page.mouse.up();
});

test("two drags of a text element in a row both move it (no stray text selection turning the second into a native drag → pointercancel), also when its text was selected beforehand", async ({ page }) => {
  await open(page);
  let { point } = await press(page, "mover");
  await page.mouse.move(point.x + 50, point.y + 30, { steps: 5 });
  await page.mouse.up();
  const first = await stored(page, "mover");
  ({ point } = await press(page, "mover"));
  await page.mouse.move(point.x + 60, point.y + 20, { steps: 5 });
  await page.mouse.up();
  const second = await stored(page, "mover");
  expect(px(second.left)).toBeCloseTo(px(first.left) + 60, 0);

  await node(page, "mover").evaluate((el) => window.getSelection()?.selectAllChildren(el)); // text already selected
  ({ point } = await press(page, "mover"));
  await page.mouse.move(point.x + 40, point.y + 10, { steps: 5 });
  await page.mouse.up();
  expect(px((await stored(page, "mover")).left)).toBeCloseTo(px(second.left) + 40, 0);
});
