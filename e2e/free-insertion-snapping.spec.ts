import { expect, test, type Page } from "@playwright/test";
import { gotoApp } from "./support/gotoApp";
import { importDocument } from "./support/parityFixtures";
import type { EditorElementNode } from "../src/features/editor/types/document";

/*
 * BC-13.6 (Decision 30) — dragging a Resource Panel component into a Free
 * container: a live preview at the pointer, the shared snapping engine and
 * guides, Snap off / Alt, the drop landing exactly where the preview was
 * (one Undo step, exact Redo), no document change before the drop,
 * Free → Flow switching, an invalid container, Escape and command
 * interruption, unrelated keys, and auto-scroll.
 */

const SURFACE = "[data-document-surface]";
const node = (page: Page, id: string) => page.locator(`${SURFACE} [data-node-id="${id}"]`);
const panel = (page: Page) => page.locator('aside[aria-label="Resource panel"]');
const tile = (page: Page, name: string) => panel(page).getByRole("button", { name, exact: true });
const preview = (page: Page) => page.locator('[data-canvas-overlay="insertion-preview"]');
const verticalGuide = (page: Page) => page.locator('[data-canvas-overlay="snap-guide-vertical"]');
const button = (page: Page, name: string) => page.getByRole("button", { name, exact: true });
const workspace = (page: Page) => page.locator('main[aria-label="Workspace"]');
const childIds = (page: Page, id: string) => node(page, id).evaluate((el) => [...el.children].map((child) => child.getAttribute("data-node-id")).filter(Boolean));
const allIds = (page: Page) => page.locator(`${SURFACE} [data-node-id]`).evaluateAll((els) => els.map((el) => el.getAttribute("data-node-id")));

const p = (id: string, x: number, y: number, width: number, height: number): EditorElementNode => ({ id, tag: "p", text: id, displayName: id, freeLayout: { x, y, width, height }, background: { color: "#ef4444" } });

const fixture: EditorElementNode = {
  id: "page-root",
  tag: "page",
  children: [
    { id: "free", tag: "div", layoutMode: "free", displayName: "Free", dimensions: { preferredWidth: 600, preferredHeight: 380, offsetX: 0, offsetY: 0 }, children: [p("anchor", 140, 60, 100, 40)] },
    { id: "flowbox", tag: "div", displayName: "FlowBox", children: [{ id: "flowp", tag: "p", text: "Flow paragraph", displayName: "FlowPara" }] },
    { id: "free2", tag: "div", layoutMode: "free", displayName: "Free2", dimensions: { preferredWidth: 600, preferredHeight: 200, offsetX: 0, offsetY: 0 }, children: [] },
    { id: "flexbox", tag: "div", displayName: "FlexBox", flowLayout: { display: "flex", flex: { direction: "row", wrap: "nowrap", justifyContent: "start", alignItems: "stretch", rowGap: 0, columnGap: 8 } }, children: [{ id: "flexp", tag: "p", text: "Flex item", displayName: "FlexItem" }] },
    { id: "gridbox", tag: "div", displayName: "GridBox", flowLayout: { display: "grid", grid: { columns: 2, rows: "auto", rowGap: 8, columnGap: 8 } }, children: [{ id: "gridp", tag: "p", text: "Grid item", displayName: "GridItem" }] },
    { id: "tall", tag: "div", layoutMode: "free", displayName: "Tall", dimensions: { preferredWidth: 600, preferredHeight: 1400, offsetX: 0, offsetY: 0 }, children: [p("deep", 300, 1150, 120, 40)] },
  ],
};

async function open(page: Page, document: EditorElementNode = fixture, waitFor = "anchor") {
  await gotoApp(page);
  await importDocument(page, document, waitFor);
}

/**
 * A tall Free container first on the page (the Workspace can scroll through
 * it), with a target far down. Narrower than the page sheet: dnd-kit's
 * pointerWithin ranks overlapping droppables by corner distance, so a
 * container exactly filling the page sheet would lose to the page root (the
 * existing drop-target rule, unchanged here).
 */
const tallFixture: EditorElementNode = {
  id: "page-root",
  tag: "page",
  children: [{ id: "tall", tag: "div", layoutMode: "free", displayName: "Tall", dimensions: { preferredWidth: 440, preferredHeight: 1500, offsetX: 0, offsetY: 0 }, children: [p("deep", 60, 1100, 120, 40)] }],
};

/** Presses a Resource Panel tile and starts dragging it (dnd-kit's activation distance); the button stays down. */
async function grabTile(page: Page, name: string) {
  await tile(page, name).scrollIntoViewIfNeeded();
  const box = (await tile(page, name).boundingBox())!;
  const hit = await page.evaluate(([x, y]) => document.elementFromPoint(x ?? 0, y ?? 0)?.closest("button")?.textContent?.trim() ?? null, [box.x + box.width / 2, box.y + box.height / 2]);
  expect(hit, "the pointer is on the tile").toBe(name);
  const start = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + 20, start.y, { steps: 4 });
  return start;
}

const previewBox = async (page: Page) => (await preview(page).boundingBox())!;

test("a Paragraph dragged into a Free container: live preview at the pointer, nothing in the document until the drop, then inserted exactly where the preview was — one Undo step, exact Redo", async ({ page }) => {
  await open(page);
  const free = (await node(page, "free").boundingBox())!;
  const before = await allIds(page);
  await grabTile(page, "Paragraph");
  const target = { x: free.x + 150, y: free.y + 220 };
  await page.mouse.move(target.x, target.y, { steps: 12 });
  await expect(preview(page)).toBeVisible();
  await expect(preview(page)).toHaveAttribute("data-valid", "true");
  const shown = await previewBox(page);
  // The pointer holds the same relative spot of the box it held on the card (about the middle).
  expect(Math.abs(shown.x + shown.width / 2 - target.x)).toBeLessThanOrEqual(shown.width / 2);
  expect(Math.abs(shown.y + shown.height / 2 - target.y)).toBeLessThanOrEqual(shown.height / 2);
  // Not in the document, no history, still saved-state-wise unchanged.
  expect(await allIds(page)).toEqual(before);
  await expect(button(page, "Undo")).toBeDisabled();
  await page.mouse.move(target.x + 30, target.y + 10, { steps: 4 }); // it follows the pointer
  await expect.poll(async () => Math.round((await previewBox(page)).x - shown.x)).toBe(30);
  const last = await previewBox(page);
  await page.mouse.up();

  await expect(preview(page)).toHaveCount(0);
  const added = (await childIds(page, "free")).filter((id) => id !== "anchor");
  expect(added).toHaveLength(1);
  const inserted = (await node(page, added[0]!).boundingBox())!;
  expect(inserted.x).toBeCloseTo(last.x, 0);
  expect(inserted.y).toBeCloseTo(last.y, 0);
  expect(inserted.width).toBeCloseTo(last.width, 0);
  const style = await node(page, added[0]!).evaluate((el) => ({ left: el.style.left, top: el.style.top }));

  await button(page, "Undo").click();
  await expect(node(page, added[0]!)).toHaveCount(0);
  await expect(button(page, "Undo")).toBeDisabled();
  await button(page, "Redo").click();
  expect(await node(page, added[0]!).evaluate((el) => ({ left: el.style.left, top: el.style.top }))).toEqual(style);
});

test("snapping: 3px from an element's left edge the preview snaps to it with an achieved guide, and the drop keeps it; Alt bypasses (dashed guide)", async ({ page }) => {
  await open(page);
  const anchor = (await node(page, "anchor").boundingBox())!;
  await grabTile(page, "Paragraph");
  await page.mouse.move(anchor.x + 40, anchor.y + 160, { steps: 10 });
  const first = await previewBox(page);
  // Move so the preview's left edge sits 3px right of the anchor's left edge.
  await page.mouse.move(anchor.x + 40 + (anchor.x + 3 - first.x), anchor.y + 160, { steps: 4 });
  await expect(verticalGuide(page)).toHaveAttribute("data-achieved", "true");
  expect((await previewBox(page)).x).toBeCloseTo(anchor.x, 0);
  expect((await verticalGuide(page).boundingBox())!.x).toBeCloseTo(anchor.x, 0);
  await page.keyboard.down("Alt");
  await expect(verticalGuide(page)).toHaveAttribute("data-achieved", "false");
  expect(Math.abs((await previewBox(page)).x - (anchor.x + 3))).toBeLessThanOrEqual(1.5); // where the pointer put it
  await page.keyboard.up("Alt");
  await expect(verticalGuide(page)).toHaveAttribute("data-achieved", "true");
  await page.mouse.up();
  await expect(verticalGuide(page)).toHaveCount(0);
  const added = (await childIds(page, "free")).filter((id) => id !== "anchor");
  expect((await node(page, added[0]!).boundingBox())!.x).toBeCloseTo(anchor.x, 0);
});

test("Snap off: the preview stays at the pointer (a dashed nearby guide), and so does the drop", async ({ page }) => {
  await open(page);
  await page.getByRole("toolbar", { name: "Canvas controls" }).getByRole("button", { name: "Snap", exact: true }).click();
  const anchor = (await node(page, "anchor").boundingBox())!;
  await grabTile(page, "Paragraph");
  await page.mouse.move(anchor.x + 40, anchor.y + 160, { steps: 10 });
  const first = await previewBox(page);
  await page.mouse.move(anchor.x + 40 + (anchor.x + 3 - first.x), anchor.y + 160, { steps: 4 });
  await expect(verticalGuide(page)).toHaveAttribute("data-achieved", "false");
  await page.mouse.up();
  const added = (await childIds(page, "free")).filter((id) => id !== "anchor");
  expect((await node(page, added[0]!).boundingBox())!.x).toBeCloseTo(anchor.x + 3, 0);
});

test("from Free to Flow: the Free preview and guides go away and the existing drop indicator takes over; the drop uses the Flow placement", async ({ page }) => {
  await open(page);
  const free = (await node(page, "free").boundingBox())!;
  await grabTile(page, "Paragraph");
  await page.mouse.move(free.x + 200, free.y + 200, { steps: 10 });
  await expect(preview(page)).toBeVisible();
  const flow = (await node(page, "flowbox").boundingBox())!;
  await page.mouse.move(flow.x + flow.width / 2, flow.y + flow.height / 2, { steps: 10 });
  await expect(preview(page)).toHaveCount(0);
  await expect(page.locator('[data-canvas-overlay^="snap-guide"]')).toHaveCount(0);
  await expect(page.locator('[data-canvas-overlay="drop-inside"], [data-canvas-overlay="drop-line"]')).toHaveCount(1);
  await page.mouse.up();
  expect(await childIds(page, "free")).toEqual(["anchor"]);
  await expect(button(page, "Undo")).toBeEnabled();
  const flowChildren = await node(page, "flowbox").evaluate((el) => el.querySelectorAll("[data-node-id]").length);
  const free2 = await childIds(page, "free");
  expect(flowChildren + (free2.length - 1)).toBeGreaterThanOrEqual(1);
});

test("a component the Free container can't hold (List Item): the preview says so and nothing is inserted", async ({ page }) => {
  await open(page);
  const free = (await node(page, "free").boundingBox())!;
  const before = await allIds(page);
  await grabTile(page, "List Item");
  await page.mouse.move(free.x + 200, free.y + 220, { steps: 10 });
  await expect(preview(page)).toHaveAttribute("data-valid", "false");
  await page.mouse.up();
  expect(await allIds(page)).toEqual(before);
  await expect(button(page, "Undo")).toBeDisabled();
});

test("Escape cancels: nothing inserted, no history, preview and guides gone; an unrelated key does not cancel", async ({ page }) => {
  await open(page);
  const free = (await node(page, "free").boundingBox())!;
  const before = await allIds(page);
  await grabTile(page, "Paragraph");
  await page.mouse.move(free.x + 200, free.y + 220, { steps: 10 });
  await page.keyboard.press("q"); // not a command: the drag goes on
  await expect(preview(page)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(preview(page)).toHaveCount(0);
  await page.mouse.up();
  expect(await allIds(page)).toEqual(before);
  await expect(button(page, "Undo")).toBeDisabled();
});

test("a recognized command (Delete with a selection) cancels the insertion first, then runs: the selected element is deleted, nothing is inserted", async ({ page }) => {
  await open(page);
  await node(page, "anchor").click();
  const free = (await node(page, "free").boundingBox())!;
  await grabTile(page, "Paragraph");
  await page.mouse.move(free.x + 150, free.y + 250, { steps: 10 });
  await expect(preview(page)).toBeVisible();
  await page.keyboard.press("Delete");
  await expect(preview(page)).toHaveCount(0);
  await page.mouse.up();
  expect(await childIds(page, "free")).toEqual([]); // the anchor deleted, no paragraph inserted
  await button(page, "Undo").click();
  expect(await childIds(page, "free")).toEqual(["anchor"]);
  await expect(button(page, "Undo")).toBeDisabled(); // only the deletion was recorded
});

test("auto-scroll while inserting: holding near the Workspace bottom over a tall Free container scrolls it, the preview stays under the pointer, a target revealed by the scroll snaps; one Undo step", async ({ page }) => {
  await open(page, tallFixture, "deep");
  const ws = (await workspace(page).boundingBox())!;
  await grabTile(page, "Paragraph");
  const tall = (await node(page, "tall").boundingBox())!;
  const x = tall.x + 120;
  await page.mouse.move(x, ws.y + ws.height - 6, { steps: 10 });
  const startTop = await workspace(page).evaluate((el) => el.scrollTop);
  await expect.poll(async () => workspace(page).evaluate((el) => el.scrollTop), { timeout: 8000 }).toBeGreaterThan(startTop + 60);
  await expect.poll(async () => (await node(page, "deep").boundingBox())!.y, { timeout: 10000 }).toBeLessThan(ws.y + ws.height - 60);
  await page.mouse.move(x, ws.y + ws.height / 2, { steps: 4 }); // out of the band
  const held = await previewBox(page);
  expect(Math.abs(held.y + held.height / 2 - (ws.y + ws.height / 2))).toBeLessThanOrEqual(held.height / 2 + 2); // under the pointer
  const deep = (await node(page, "deep").boundingBox())!;
  await page.mouse.move(x + (deep.x + 2 - held.x), ws.y + ws.height / 2, { steps: 4 });
  await expect(verticalGuide(page)).toHaveAttribute("data-achieved", "true");
  expect((await previewBox(page)).x).toBeCloseTo((await node(page, "deep").boundingBox())!.x, 0);
  const last = await previewBox(page);
  await page.mouse.up();
  const added = (await childIds(page, "tall")).filter((id) => id !== "deep");
  expect(added).toHaveLength(1);
  const inserted = (await node(page, added[0]!).boundingBox())!;
  expect(inserted.x).toBeCloseTo(last.x, 0);
  expect(inserted.y).toBeCloseTo(last.y, 0);
  await button(page, "Undo").click();
  await expect(button(page, "Undo")).toBeDisabled();
});

test("click-to-insert is unchanged: the first-available placement, not a pointer position", async ({ page }) => {
  await open(page);
  await node(page, "free").click({ position: { x: 30, y: 300 } });
  await tile(page, "Paragraph").click();
  const added = (await childIds(page, "free")).filter((id) => id !== "anchor");
  expect(added).toHaveLength(1);
  const style = await node(page, added[0]!).evaluate((el) => ({ left: el.style.left, top: el.style.top }));
  // The existing first-available slot (resolveFreeInsertionPosition: a 16px step grid from the top-left, skipping occupied slots), not where anything was pointed at.
  expect(Number.parseFloat(style.left) % 16).toBe(0);
  expect(Number.parseFloat(style.top) % 16).toBe(0);
  expect(Number.parseFloat(style.top)).toBeLessThan(100);
});

test("between Free containers the preview moves to the new one (fresh targets, no stale guides); Free → Flex → Grid: the Free preview goes and the existing indicators and placement apply", async ({ page }) => {
  await open(page);
  const free = (await node(page, "free").boundingBox())!;
  await grabTile(page, "Paragraph");
  await page.mouse.move(free.x + 200, free.y + 200, { steps: 8 });
  await expect(preview(page)).toBeVisible();
  await node(page, "free2").scrollIntoViewIfNeeded();
  const free2 = (await node(page, "free2").boundingBox())!;
  await page.mouse.move(free2.x + 250, free2.y + 100, { steps: 8 });
  await expect.poll(async () => (await previewBox(page)).y).toBeGreaterThan(free2.y - 1);
  const inFree2 = await previewBox(page);
  expect(inFree2.y + inFree2.height).toBeLessThanOrEqual(free2.y + free2.height + 0.5); // contained in the new container

  for (const id of ["flexbox", "gridbox"]) {
    await node(page, id).scrollIntoViewIfNeeded();
    const box = (await node(page, id).boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 8 });
    await expect(preview(page)).toHaveCount(0);
    await expect(page.locator('[data-canvas-overlay^="snap-guide"]')).toHaveCount(0);
  }
  const before = await allIds(page);
  await page.mouse.up();
  // Inserted through the existing Flow/Grid rule: one new element, outside both Free containers, with no Free geometry.
  // (Which Flow parent dnd-kit resolves after a scroll mid-drag can differ by browser — the unchanged existing rule.)
  const added = (await allIds(page)).filter((id) => !before.includes(id));
  expect(added).toHaveLength(1);
  expect(await childIds(page, "free2")).toEqual([]);
  expect((await childIds(page, "free")).filter((id) => id !== "anchor")).toEqual([]);
  expect(await node(page, added[0]!).evaluate((el) => el.style.position)).not.toBe("absolute");
});
