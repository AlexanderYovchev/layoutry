import { expect, test, type Page } from "@playwright/test";
import { gotoApp } from "./support/gotoApp";
import { importDocument } from "./support/parityFixtures";
import type { EditorElementNode } from "../src/features/editor/types/document";

/*
 * BC-13.4 — Free resize handles on the shared snapping engine, in the real
 * browser: edge and corner handles snap only their own edges (the opposite
 * edge stays), ratio-locked corners, Alt and Snap off, guides on the
 * rendered edges in a padded/bordered container, containment, Undo/Redo.
 */

const SURFACE = "[data-document-surface]";
const node = (page: Page, id: string) => page.locator(`${SURFACE} [data-node-id="${id}"]`);
const verticalGuide = (page: Page) => page.locator('[data-canvas-overlay="snap-guide-vertical"]');
const horizontalGuide = (page: Page) => page.locator('[data-canvas-overlay="snap-guide-horizontal"]');
const handle = (page: Page, direction: string) => page.locator(`[data-resize-handle="${direction}"]`);
const px = (value: number) => ({ value, unit: "px" as const });
const side = (width: number) => ({ width: px(width), style: "solid" as const, color: "#000000" });

const box = (id: string, x: number, y: number, width: number, height: number, color: string, extra: Partial<EditorElementNode> = {}): EditorElementNode => ({
  id,
  tag: "p",
  text: id,
  displayName: id,
  freeLayout: { x, y, width, height },
  background: { color },
  ...extra,
});

const fixture: EditorElementNode = {
  id: "page-root",
  tag: "page",
  children: [
    {
      id: "free",
      tag: "div",
      layoutMode: "free",
      dimensions: { preferredWidth: 700, preferredHeight: 420, offsetX: 0, offsetY: 0 },
      children: [
        box("target", 300, 140, 120, 60, "#3b82f6"),
        box("anchor", 100, 40, 100, 50, "#ef4444"), // right edge 200, bottom 90
        box("wall", 470, 300, 60, 40, "#22c55e"), // left edge 470, top 300 (inside the default container padding's containment, 534 × 354)
        box("ratio", 300, 210, 80, 40, "#a855f7", { aspectRatioLocked: true }), // SE to the wall: bottom ≈ 293, no horizontal line within 6px
      ],
    },
    {
      id: "padded",
      tag: "div",
      layoutMode: "free",
      dimensions: { preferredWidth: 520, preferredHeight: 300, offsetX: 0, offsetY: 0 },
      spacing: { padding: { top: 10, right: 40, bottom: 30, left: 20 } },
      border: { top: side(6), right: side(6), bottom: side(6), left: side(6) },
      children: [box("inner", 20, 20, 100, 60, "#f59e0b", { spacing: { margin: { left: 8, top: 4 } } })],
    },
  ],
};

async function open(page: Page, select = "target") {
  await gotoApp(page);
  await importDocument(page, fixture, "target");
  await node(page, select).click();
  await expect(handle(page, "e")).toBeVisible();
}

/** Presses a handle and moves it by (dx, dy) in steps; the pointer stays down. */
async function pull(page: Page, direction: string, dx: number, dy: number) {
  const rect = (await handle(page, direction).boundingBox())!;
  const x = rect.x + rect.width / 2;
  const y = rect.y + rect.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx, y + dy, { steps: 10 });
}

const rect = async (page: Page, id: string) => (await node(page, id).boundingBox())!;

test("east: the right edge snaps to an element's edge, the left edge stays, the guide is on it; one Undo step, exact Redo", async ({ page }) => {
  await open(page);
  const start = await rect(page, "target");
  const wall = await rect(page, "wall");
  await pull(page, "e", wall.x - (start.x + start.width) - 4, 0); // 4px short of the wall's left edge
  await expect(verticalGuide(page)).toHaveAttribute("data-achieved", "true");
  expect((await verticalGuide(page).boundingBox())!.x).toBeCloseTo(wall.x, 0);
  const resized = await rect(page, "target");
  expect(resized.x + resized.width).toBeCloseTo(wall.x, 1);
  expect(resized.x).toBeCloseTo(start.x, 1);
  await page.mouse.up();
  await expect(verticalGuide(page)).toHaveCount(0);

  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect.poll(async () => Math.round((await rect(page, "target")).width)).toBe(Math.round(start.width));
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await expect.poll(async () => Math.round(((await rect(page, "target")).x + (await rect(page, "target")).width) * 10) / 10).toBeCloseTo(wall.x, 0);
});

test("west and north: the left/top edge snaps while the right/bottom edge stays anchored", async ({ page }) => {
  await open(page);
  const start = await rect(page, "target");
  const anchor = await rect(page, "anchor");
  await pull(page, "w", anchor.x + anchor.width - start.x + 3, 0); // 3px right of the anchor's right edge
  let now = await rect(page, "target");
  expect(now.x).toBeCloseTo(anchor.x + anchor.width, 1);
  expect(now.x + now.width).toBeCloseTo(start.x + start.width, 1);
  await page.mouse.up();

  const before = await rect(page, "target");
  await pull(page, "n", 0, anchor.y + anchor.height - before.y + 4); // 4px below the anchor's bottom edge
  await expect(horizontalGuide(page)).toHaveAttribute("data-achieved", "true");
  now = await rect(page, "target");
  expect(now.y).toBeCloseTo(anchor.y + anchor.height, 1);
  expect(now.y + now.height).toBeCloseTo(before.y + before.height, 1);
  await page.mouse.up();
});

test("south and a free corner: vertical snapping, then X and Y snapping independently", async ({ page }) => {
  await open(page);
  const start = await rect(page, "target");
  const wall = await rect(page, "wall");
  await pull(page, "s", 0, wall.y - (start.y + start.height) - 5);
  let now = await rect(page, "target");
  expect(now.y + now.height).toBeCloseTo(wall.y, 1);
  expect(now.y).toBeCloseTo(start.y, 1);
  await page.mouse.up();

  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect.poll(async () => Math.round((await rect(page, "target")).height)).toBe(Math.round(start.height));
  await pull(page, "se", wall.x - (start.x + start.width) - 3, wall.y - (start.y + start.height) + 4);
  await expect(verticalGuide(page)).toHaveAttribute("data-achieved", "true");
  await expect(horizontalGuide(page)).toHaveAttribute("data-achieved", "true");
  now = await rect(page, "target");
  expect(now.x + now.width).toBeCloseTo(wall.x, 1);
  expect(now.y + now.height).toBeCloseTo(wall.y, 1);
  expect(now.x).toBeCloseTo(start.x, 1);
  expect(now.y).toBeCloseTo(start.y, 1);
  await page.mouse.up();
});

test("a ratio-locked corner keeps its ratio while snapping", async ({ page }) => {
  await open(page, "ratio");
  const start = await rect(page, "ratio");
  const wall = await rect(page, "wall");
  await pull(page, "se", wall.x - (start.x + start.width) - 4, 0);
  const now = await rect(page, "ratio");
  expect(now.x + now.width).toBeCloseTo(wall.x, 1);
  expect(now.width / now.height).toBeCloseTo(start.width / start.height, 2);
  await page.mouse.up();
});

test("Alt bypasses resize snapping (nearby guide), releasing it snaps; Snap off does not snap and keeps a nearby guide", async ({ page }) => {
  await open(page);
  const start = await rect(page, "target");
  const wall = await rect(page, "wall");
  await page.keyboard.down("Alt");
  await pull(page, "e", wall.x - (start.x + start.width) - 4, 0);
  await expect(verticalGuide(page)).toHaveAttribute("data-achieved", "false");
  expect((await rect(page, "target")).x + (await rect(page, "target")).width).toBeCloseTo(wall.x - 4, 0);
  await page.keyboard.up("Alt");
  await expect(verticalGuide(page)).toHaveAttribute("data-achieved", "true");
  await page.mouse.up();
  await page.getByRole("button", { name: "Undo", exact: true }).click();

  await page.getByRole("toolbar", { name: "Canvas controls" }).getByRole("button", { name: "Snap", exact: true }).click();
  await node(page, "target").click();
  const again = await rect(page, "target");
  await pull(page, "e", wall.x - (again.x + again.width) - 4, 0);
  await expect(verticalGuide(page)).toHaveAttribute("data-achieved", "false");
  expect((await rect(page, "target")).x + (await rect(page, "target")).width).toBeCloseTo(wall.x - 4, 0);
  await page.mouse.up();
});

test("padded, bordered container: the guide sits on the rendered padding-box centre; growing past containment shows no false guide", async ({ page }) => {
  await open(page, "inner");
  const container = await node(page, "padded").evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { left: r.left + el.clientLeft, width: el.clientWidth };
  });
  const centre = container.left + container.width / 2;
  const start = await rect(page, "inner");
  await pull(page, "e", centre - (start.x + start.width) + 3, 0);
  await expect(verticalGuide(page)).toHaveAttribute("data-achieved", "true");
  expect((await verticalGuide(page).boundingBox())!.x).toBeCloseTo(centre, 0);
  const now = await rect(page, "inner");
  expect(now.x + now.width).toBeCloseTo(centre, 1); // the rendered (margin-shifted) right edge
  // Keep pulling far past the padding edge: clamped by the unchanged containment, no guide on the padding edge.
  await page.mouse.move((await handle(page, "e").boundingBox())!.x + 600, (await handle(page, "e").boundingBox())!.y + 2, { steps: 8 });
  const clamped = await rect(page, "inner");
  expect(clamped.x + clamped.width).toBeLessThanOrEqual(container.left + container.width + 0.5);
  const guide = verticalGuide(page);
  if ((await guide.count()) > 0) expect(Math.abs((await guide.boundingBox())!.x - (container.left + container.width))).toBeGreaterThan(1);
  await page.mouse.up();
});
