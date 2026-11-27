import { expect, test, type Page } from "@playwright/test";
import { gotoApp } from "./support/gotoApp";
import { importDocument } from "./support/parityFixtures";
import { installDeclaredStyle } from "./support/declaredStyle";
import type { EditorElementNode } from "../src/features/editor/types/document";

// BC-17.3: stored geometry lives in the generated document sheet, not inline (see support/declaredStyle.ts).
test.beforeEach(({ page }) => installDeclaredStyle(page));

/*
 * BC-13.7 — final-audit gaps that had no browser evidence:
 * - resizing an element with an authored CSS max-width never shows an
 *   achieved guide for an edge the CSS clamp keeps it from (the defect
 *   corrected in BC-13.7);
 * - margins (Decision 25) for DRAGGING (equal spacing between margined
 *   siblings) and RESIZING (alignment to a margined target);
 * - equal-spacing snapping while resizing, with its indicator;
 * - no-op drag/resize history;
 * - Export isolation after a drag, a resize and an insertion.
 */

const SURFACE = "[data-document-surface]";
const node = (page: Page, id: string) => page.locator(`${SURFACE} [data-node-id="${id}"]`);
const button = (page: Page, name: string) => page.getByRole("button", { name, exact: true });
const vertical = (page: Page) => page.locator('[data-canvas-overlay="snap-guide-vertical"]');
const stored = (page: Page, id: string) => node(page, id).evaluate((el) => ({ left: window.__lyDeclaredStyle(el).left, top: window.__lyDeclaredStyle(el).top, width: window.__lyDeclaredStyle(el).width, marginLeft: window.__lyDeclaredStyle(el).marginLeft }));

const p = (id: string, x: number, y: number, width: number, height: number, extra: Partial<EditorElementNode> = {}): EditorElementNode => ({
  id,
  tag: "p",
  text: id,
  displayName: id,
  freeLayout: { x, y, width, height },
  background: { color: "#93c5fd" },
  ...extra,
});
const margin = (left: number) => ({ spacing: { margin: { left, top: 0 } } });

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
        p("capped", 20, 20, 100, 40, { sizeConstraints: { maxWidth: 150 } }),
        p("wall", 300, 20, 60, 40),
        p("ma", 20, 200, 60, 40, margin(10)), // renders 30..90
        p("mb", 110, 200, 60, 40, margin(10)), // renders 120..180 — a 30px border-box gap
        p("mover", 380, 300, 100, 40),
        p("mt", 500, 220, 30, 30, margin(12)), // renders from 512
        p("rs", 150, 120, 150, 40),
        p("pa", 380, 120, 40, 40),
        p("pb", 450, 120, 40, 40), // pa→pb gap 30; one gap before pa = 350
      ],
    },
  ],
};

async function open(page: Page) {
  await gotoApp(page);
  await importDocument(page, fixture, "mover");
}

async function pullHandle(page: Page, id: string, direction: string, dx: number, dy = 0) {
  await node(page, id).click();
  const handle = (await page.locator(`[data-resize-handle="${direction}"]`).boundingBox())!;
  const x = handle.x + handle.width / 2;
  const y = handle.y + handle.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx, y + dy, { steps: 8 });
  return { x, y };
}

test("authored max-width: resizing past it never shows an achieved guide for an edge the CSS clamp keeps the element from (BC-13.7 correction)", async ({ page }) => {
  await open(page);
  const capped = (await node(page, "capped").boundingBox())!;
  const wall = (await node(page, "wall").boundingBox())!;
  // Stored right edge 4px short of the wall's left edge; the element renders at its 150px max-width.
  await pullHandle(page, "capped", "e", wall.x - (capped.x + capped.width) - 4);
  await page.waitForTimeout(150);
  const rendered = (await node(page, "capped").boundingBox())!;
  expect(rendered.width).toBeCloseTo(150, 0);
  const guide = vertical(page);
  if ((await guide.count()) > 0) {
    // Whatever guide shows must not claim the wall's edge as achieved.
    const atWall = Math.abs((await guide.boundingBox())!.x - wall.x) < 3;
    expect(atWall && (await guide.getAttribute("data-achieved")) === "true").toBe(false);
  }
  await page.mouse.up();
  expect((await node(page, "capped").boundingBox())!.width).toBeCloseTo(150, 0);
});

test("dragging (Decision 25): equal spacing between margined siblings uses their border boxes; the label is the border-box gap; margins unchanged", async ({ page }) => {
  await open(page);
  const ma = (await node(page, "ma").boundingBox())!;
  const mb = (await node(page, "mb").boundingBox())!;
  const gap = mb.x - (ma.x + ma.width); // 30, border box to border box
  expect(gap).toBeCloseTo(30, 0);
  const mover = (await node(page, "mover").boundingBox())!;
  const grab = { x: mover.x + 20, y: mover.y + 20 };
  await page.mouse.move(grab.x, grab.y);
  await page.mouse.down();
  // Same row as the pair, left edge 3px short of one gap after mb.
  await page.mouse.move(grab.x + (mb.x + mb.width + gap - 3 - mover.x), grab.y + (mb.y - mover.y), { steps: 10 });
  await expect(page.locator('[data-canvas-overlay="snap-spacing-gap"]')).toHaveCount(2);
  await expect(page.locator('[data-canvas-overlay="snap-spacing-label"]').first()).toHaveText("30");
  expect((await node(page, "mover").boundingBox())!.x).toBeCloseTo(mb.x + mb.width + gap, 0);
  await page.mouse.up();
  expect((await stored(page, "ma")).marginLeft).toBe("10px");
  expect((await stored(page, "mb")).marginLeft).toBe("10px");
});

test("resizing (Decision 25): the active edge aligns with a margined target's border box, never its margin edge", async ({ page }) => {
  await open(page);
  const mover = (await node(page, "mover").boundingBox())!;
  const mt = (await node(page, "mt").boundingBox())!; // border box (margin-left 12 excluded)
  // 3px past the margin edge (mt.x − 12): nothing to snap to there.
  await pullHandle(page, "mover", "e", mt.x - 12 + 3 - (mover.x + mover.width));
  await page.waitForTimeout(150);
  const near = (await node(page, "mover").boundingBox())!;
  expect(near.x + near.width).toBeCloseTo(mt.x - 9, 0);
  // 3px short of the border-box edge: snaps to it, with the guide there.
  await page.mouse.move(near.x + near.width + 6, (await page.locator('[data-resize-handle="e"]').boundingBox())!.y + 4, { steps: 4 });
  await expect(vertical(page)).toHaveAttribute("data-achieved", "true");
  const snapped = (await node(page, "mover").boundingBox())!;
  expect(snapped.x + snapped.width).toBeCloseTo(mt.x, 0);
  expect((await vertical(page).boundingBox())!.x).toBeCloseTo(mt.x, 0);
  expect(snapped.x).toBeCloseTo(mover.x, 0); // the left edge stayed anchored
  await page.mouse.up();
});

test("resizing with equal spacing: the right edge snaps one gap before a pair, with the indicator; the left edge stays", async ({ page }) => {
  await open(page);
  const rs = (await node(page, "rs").boundingBox())!;
  const pa = (await node(page, "pa").boundingBox())!;
  const pb = (await node(page, "pb").boundingBox())!;
  const gap = pb.x - (pa.x + pa.width);
  await pullHandle(page, "rs", "e", pa.x - gap - 2 - (rs.x + rs.width)); // 2px short
  await expect(page.locator('[data-canvas-overlay="snap-spacing-gap"]')).toHaveCount(2);
  const now = (await node(page, "rs").boundingBox())!;
  expect(now.x + now.width).toBeCloseTo(pa.x - gap, 0);
  expect(now.x).toBeCloseTo(rs.x, 0);
  await page.mouse.up();
  await expect(button(page, "Undo")).toBeEnabled();
});

test("no-op: a drag or a resize that ends where it started records nothing", async ({ page }) => {
  await open(page);
  const mover = (await node(page, "mover").boundingBox())!;
  await page.mouse.move(mover.x + 20, mover.y + 20);
  await page.mouse.down();
  await page.mouse.move(mover.x + 120, mover.y + 60, { steps: 6 });
  await page.mouse.move(mover.x + 20, mover.y + 20, { steps: 6 });
  await page.mouse.up();
  await expect(button(page, "Undo")).toBeDisabled();
  const start = await pullHandle(page, "mover", "e", 60);
  await page.mouse.move(start.x, start.y, { steps: 6 });
  await page.mouse.up();
  await expect(button(page, "Undo")).toBeDisabled();
});

test("Export isolation after a snapped drag, a snapped resize and a Resource Panel insertion: no guide, preview, snap or editor-overlay markup", async ({ page }) => {
  await open(page);
  // A snapped drag (equal spacing), a snapped resize, an insertion.
  const ma = (await node(page, "ma").boundingBox())!;
  const mb = (await node(page, "mb").boundingBox())!;
  const mover = (await node(page, "mover").boundingBox())!;
  await page.mouse.move(mover.x + 20, mover.y + 20);
  await page.mouse.down();
  await page.mouse.move(mover.x + 20 + (mb.x + mb.width + (mb.x - ma.x - ma.width) - 3 - mover.x), mover.y + 20 + (mb.y - mover.y), { steps: 8 });
  await page.mouse.up();
  const rs = (await node(page, "rs").boundingBox())!;
  const pa = (await node(page, "pa").boundingBox())!;
  await pullHandle(page, "rs", "e", pa.x - 30 - 2 - (rs.x + rs.width));
  await page.mouse.up();
  const tile = page.locator('aside[aria-label="Resource panel"]').getByRole("button", { name: "Paragraph", exact: true });
  await tile.scrollIntoViewIfNeeded();
  const t = (await tile.boundingBox())!;
  const free = (await node(page, "free").boundingBox())!;
  await page.mouse.move(t.x + t.width / 2, t.y + t.height / 2);
  await page.mouse.down();
  await page.mouse.move(t.x + t.width / 2 + 20, t.y + t.height / 2, { steps: 4 });
  await page.mouse.move(free.x + 250, free.y + 200, { steps: 10 });
  await expect(page.locator('[data-canvas-overlay="insertion-preview"]')).toBeVisible();
  await page.mouse.up();
  await expect(page.locator('[data-canvas-overlay="insertion-preview"]')).toHaveCount(0);

  await page.getByRole("button", { name: "Export Code" }).click();
  const code = (await page.getByRole("dialog", { name: "Export Code" }).getByTestId("export-code").textContent()) ?? "";
  await page.keyboard.press("Escape");
  expect(code.length).toBeGreaterThan(100);
  expect(code).not.toMatch(/data-canvas-overlay|snap-guide|snap-spacing|insertion-preview|Canvas controls|data-document-surface/i);
});
