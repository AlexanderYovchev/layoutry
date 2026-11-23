import { expect, test, type Page } from "@playwright/test";
import { gotoApp } from "./support/gotoApp";
import { importDocument } from "./support/parityFixtures";
import type { EditorElementNode } from "../src/features/editor/types/document";

/*
 * BC-13.3 — Free dragging on the shared snapping engine, in the real
 * browser: alignment with an accurate guide and distance label, Alt bypass,
 * Shift axis lock, equal spacing, the Canvas Snap control and its global
 * persistence, Undo/Redo, Preview/Export isolation.
 */

const SURFACE = "[data-document-surface]";
const node = (page: Page, id: string) => page.locator(`${SURFACE} [data-node-id="${id}"]`);
const verticalGuide = (page: Page) => page.locator('[data-canvas-overlay="snap-guide-vertical"]');
const snapToggle = (page: Page) => page.getByRole("toolbar", { name: "Canvas controls" }).getByRole("button", { name: "Snap", exact: true });

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
        box("mover", 400, 120, 80, 40, "#3b82f6"),
        box("anchor", 120, 40, 100, 50, "#ef4444"),
        box("row-a", 20, 220, 80, 40, "#22c55e"),
        box("row-b", 130, 220, 80, 40, "#22c55e"),
      ],
    },
  ],
};

async function open(page: Page) {
  await gotoApp(page);
  await importDocument(page, fixture, "row-b");
}

async function grab(page: Page, id = "mover") {
  const rect = (await node(page, id).boundingBox())!;
  const point = { x: rect.x + 20, y: rect.y + 20 };
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  return { rect, point };
}

/** Moves the pointer so the mover's left edge lands at `targetLeft` (client px), keeping the grab offset. */
async function moveLeftEdgeTo(page: Page, grabbed: { rect: { x: number }; point: { x: number; y: number } }, targetLeft: number, dy = 0) {
  await page.mouse.move(grabbed.point.x + (targetLeft - grabbed.rect.x), grabbed.point.y + dy, { steps: 10 });
}

test("dragging near an element's edge snaps to it; the guide is on the rendered edge with a CSS-px distance label; one Undo step", async ({ page }) => {
  await open(page);
  const anchor = (await node(page, "anchor").boundingBox())!;
  const grabbed = await grab(page);
  await moveLeftEdgeTo(page, grabbed, anchor.x + 4); // 4px from the anchor's left edge
  await expect(verticalGuide(page)).toHaveAttribute("data-achieved", "true");
  const guide = (await verticalGuide(page).boundingBox())!;
  expect(guide.x).toBeCloseTo(anchor.x, 0);
  expect((await node(page, "mover").boundingBox())!.x).toBeCloseTo(anchor.x, 1);
  const moverTop = (await node(page, "mover").boundingBox())!.y;
  await expect(page.locator('[data-canvas-overlay="snap-distance-label"]')).toHaveText(String(Math.round(moverTop - (anchor.y + anchor.height))));
  await page.mouse.up();
  await expect(verticalGuide(page)).toHaveCount(0);

  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect.poll(async () => Math.round((await node(page, "mover").boundingBox())!.x - grabbed.rect.x)).toBe(0);
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await expect.poll(async () => Math.round((await node(page, "mover").boundingBox())!.x)).toBe(Math.round(anchor.x));
});

test("Alt bypasses snapping (a dashed nearby guide stays); releasing Alt snaps; the toggle is untouched", async ({ page }) => {
  await open(page);
  const anchor = (await node(page, "anchor").boundingBox())!;
  const grabbed = await grab(page);
  await page.keyboard.down("Alt");
  await moveLeftEdgeTo(page, grabbed, anchor.x + 4);
  await expect(verticalGuide(page)).toHaveAttribute("data-achieved", "false");
  expect((await node(page, "mover").boundingBox())!.x).toBeCloseTo(anchor.x + 4, 0);
  await page.keyboard.up("Alt");
  await expect(verticalGuide(page)).toHaveAttribute("data-achieved", "true");
  expect((await node(page, "mover").boundingBox())!.x).toBeCloseTo(anchor.x, 1);
  await page.mouse.up();
  await expect(snapToggle(page)).toHaveAttribute("aria-pressed", "true");
});

test("Shift keeps the drag on the dominant axis", async ({ page }) => {
  await open(page);
  const grabbed = await grab(page);
  await page.keyboard.down("Shift");
  await page.mouse.move(grabbed.point.x - 150, grabbed.point.y + 30, { steps: 10 });
  const moved = (await node(page, "mover").boundingBox())!;
  expect(moved.y).toBeCloseTo(grabbed.rect.y, 1);
  expect(moved.x).toBeLessThan(grabbed.rect.x - 100);
  await page.mouse.up();
  await page.keyboard.up("Shift");
});

test("equal spacing: dropping one gap after a pair snaps and shows the equal gaps", async ({ page }) => {
  await open(page);
  const b = (await node(page, "row-b").boundingBox())!;
  const a = (await node(page, "row-a").boundingBox())!;
  const gap = b.x - (a.x + a.width); // 30 (one gap after row-b puts the mover's centre away from the parent centre)
  const grabbed = await grab(page);
  // Same row as the pair, left edge 3px short of one equal gap after row-b.
  await page.mouse.move(grabbed.point.x + (b.x + b.width + gap - 3 - grabbed.rect.x), grabbed.point.y + (b.y - grabbed.rect.y), { steps: 10 });
  await expect(page.locator('[data-canvas-overlay="snap-spacing-gap"]')).toHaveCount(2);
  await expect(page.locator('[data-canvas-overlay="snap-spacing-label"]').first()).toHaveText(String(Math.round(gap)));
  expect((await node(page, "mover").boundingBox())!.x).toBeCloseTo(b.x + b.width + gap, 1);
  await page.mouse.up();
});

test("the Canvas Snap control turns snapping off globally (guides stay, dashed) and the choice survives a reload", async ({ page }) => {
  await open(page);
  await expect(page.getByRole("switch", { name: "Snap" })).toHaveCount(0); // the Inspector toggle is gone
  await snapToggle(page).click();
  await expect(snapToggle(page)).toHaveAttribute("aria-pressed", "false");
  const anchor = (await node(page, "anchor").boundingBox())!;
  const grabbed = await grab(page);
  await moveLeftEdgeTo(page, grabbed, anchor.x + 4);
  await expect(verticalGuide(page)).toHaveAttribute("data-achieved", "false");
  expect((await node(page, "mover").boundingBox())!.x).toBeCloseTo(anchor.x + 4, 0);
  await page.mouse.up();
  // Global and persistent: still off after a reload (a fresh editor, no project involved).
  await page.reload();
  await gotoApp(page);
  await expect(snapToggle(page)).toHaveAttribute("aria-pressed", "false");
  await snapToggle(page).click();
  await expect(snapToggle(page)).toHaveAttribute("aria-pressed", "true");

  await page.getByRole("button", { name: "About snapping" }).click();
  await expect(page.getByRole("dialog", { name: "About snapping" })).toContainText("6 screen pixels");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "About snapping" })).toHaveCount(0);
});

test("Preview and Export carry no snapping UI", async ({ page }) => {
  await open(page);
  await page.getByRole("button", { name: "Enter Preview", exact: true }).click();
  await expect(page.getByRole("toolbar", { name: "Canvas controls" })).toHaveCount(0);
  await page.getByRole("button", { name: "Exit Preview", exact: true }).click();
  await page.getByRole("button", { name: "Export Code" }).click();
  const code = (await page.getByRole("dialog", { name: "Export Code" }).getByTestId("export-code").textContent()) ?? "";
  await page.keyboard.press("Escape");
  expect(code).not.toMatch(/snap|canvas-overlay|Canvas controls/i);
});
