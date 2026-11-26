import { expect, test, type Page } from "@playwright/test";
import { gotoApp } from "./support/gotoApp";
import { importDocument } from "./support/parityFixtures";
import type { EditorElementNode } from "../src/features/editor/types/document";

/*
 * BC-13.5 — the Free drag/resize lifecycle in a real browser: Escape (drag,
 * resize, Canvas Flow drag) keeps the selection and records nothing;
 * edge auto-scroll of the Workspace and of nested scroll containers with
 * the element kept under the pointer; it stops on release, on Escape and at
 * the boundary; snap targets scrolled into view become usable; Delete
 * mid-drag; a SIMULATED pointercancel (a synthetic event, not a device).
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
      children: [p("mover", 60, 60, 100, 40, "#3b82f6"), p("deep", 300, 1100, 120, 40, "#ef4444")],
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
  const stored = await node(page, "mover").evaluate((el) => ({ left: el.style.left, top: el.style.top }));
  const { rect, point } = await press(page, "mover");
  await page.mouse.move(point.x + 90, point.y + 70, { steps: 8 });
  await expect.poll(async () => (await node(page, "mover").boundingBox())!.x).toBeGreaterThan(rect.x + 60);
  await page.keyboard.press("Escape");
  await page.mouse.up();
  expect(await node(page, "mover").evaluate((el) => ({ left: el.style.left, top: el.style.top }))).toEqual(stored); // the exact stored position
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
  const before = await node(page, "mover").evaluate((el) => ({ left: el.style.left, top: el.style.top }));
  const { point } = await press(page, "mover");
  await page.mouse.move(point.x, workspace.y + workspace.height - 6, { steps: 8 });
  await page.waitForTimeout(400);
  await page.keyboard.press("Escape");
  const at = (await workspaceScroll(page)).top;
  expect(at).toBeGreaterThan(0);
  await page.waitForTimeout(300);
  expect((await workspaceScroll(page)).top).toBe(at);
  await page.mouse.up();
  expect(await node(page, "mover").evaluate((el) => ({ left: el.style.left, top: el.style.top }))).toEqual(before);
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
  const before = await node(page, "mover").evaluate((el) => ({ left: el.style.left, top: el.style.top }));
  const { point } = await press(page, "mover");
  await page.mouse.move(point.x + 120, point.y + 90, { steps: 8 });
  await page.keyboard.press("Delete");
  await page.mouse.move(point.x + 150, point.y + 100, { steps: 3 });
  await page.mouse.up();
  await expect(node(page, "mover")).toHaveCount(0);
  await button(page, "Undo").click();
  await expect(node(page, "mover")).toHaveCount(1);
  expect(await node(page, "mover").evaluate((el) => ({ left: el.style.left, top: el.style.top }))).toEqual(before);
  await expect(button(page, "Undo")).toBeDisabled();
});

test("a (simulated) pointercancel mid-drag rolls back instead of committing", async ({ page }) => {
  await open(page);
  const before = await node(page, "mover").evaluate((el) => ({ left: el.style.left, top: el.style.top }));
  const { point } = await press(page, "mover");
  await page.mouse.move(point.x + 100, point.y + 50, { steps: 8 });
  await expect.poll(async () => node(page, "mover").evaluate((el) => el.style.left)).not.toBe(before.left);
  await node(page, "mover").dispatchEvent("pointercancel", { pointerId: 1, bubbles: true, pointerType: "touch" });
  await page.mouse.up();
  expect(await node(page, "mover").evaluate((el) => ({ left: el.style.left, top: el.style.top }))).toEqual(before);
  await expect(button(page, "Undo")).toBeDisabled();
  await expect(page.locator('[data-canvas-overlay^="snap-guide"]')).toHaveCount(0);
});
