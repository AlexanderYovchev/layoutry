import { expect, test, type Page } from "@playwright/test";
import { gotoApp } from "./support/gotoApp";
import { importDocument } from "./support/parityFixtures";
import type { EditorElementNode } from "../src/features/editor/types/document";

/*
 * BC-13.2 — Free-container coordinates in the real browser. In a container
 * with asymmetric padding and a border, stored positions render exactly
 * where they did before (from the padding edge), and the existing drag
 * snap's guides now sit on the rendered edges (they used to be off by
 * padding − border).
 */

const SURFACE = "[data-document-surface]";
const node = (page: Page, id: string) => page.locator(`${SURFACE} [data-node-id="${id}"]`);
const verticalGuide = (page: Page) => page.locator('[data-canvas-overlay="snap-guide-vertical"]');
const horizontalGuide = (page: Page) => page.locator('[data-canvas-overlay="snap-guide-horizontal"]');
const px = (value: number) => ({ value, unit: "px" as const });
const side = (width: number) => ({ width: px(width), style: "solid" as const, color: "#000000" });

const fixture: EditorElementNode = {
  id: "page-root",
  tag: "page",
  children: [
    {
      id: "box",
      tag: "div",
      layoutMode: "free",
      dimensions: { preferredWidth: 520, preferredHeight: 360, offsetX: 0, offsetY: 0 },
      spacing: { padding: { top: 10, right: 40, bottom: 30, left: 20 } },
      border: { top: side(6), right: side(6), bottom: side(6), left: side(6) },
      children: [
        { id: "mover", tag: "div", displayName: "Mover", freeLayout: { x: 0, y: 0, width: 100, height: 40 }, background: { color: "#3b82f6" }, children: [] },
        { id: "sib", tag: "div", displayName: "Sibling", freeLayout: { x: 320, y: 150, width: 80, height: 50 }, spacing: { margin: { left: 8, top: 4 } }, background: { color: "#ef4444" }, children: [] },
      ],
    },
  ],
};

interface Metrics {
  boxLeft: number;
  boxTop: number;
  border: number;
  clientWidth: number;
  clientHeight: number;
}

async function metrics(page: Page): Promise<Metrics> {
  return node(page, "box").evaluate((el) => {
    const rect = el.getBoundingClientRect();
    return { boxLeft: rect.left, boxTop: rect.top, border: el.clientLeft, clientWidth: el.clientWidth, clientHeight: el.clientHeight };
  });
}

/** Drags the mover by (dx, dy) in small steps and returns while the pointer is still down. */
async function dragMover(page: Page, dx: number, dy: number) {
  const start = (await node(page, "mover").boundingBox())!;
  const x = start.x + 30;
  const y = start.y + 20;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx, y + dy, { steps: 12 });
}

test.beforeEach(async ({ page }) => {
  await gotoApp(page);
  await importDocument(page, fixture, "sib");
});

test("stored positions render where they always did: from the padding edge, plus the child's own margin", async ({ page }) => {
  const m = await metrics(page);
  const mover = (await node(page, "mover").boundingBox())!;
  const sib = (await node(page, "sib").boundingBox())!;
  expect(mover.x - m.boxLeft).toBeCloseTo(m.border, 1); // x=0 → the inner border edge, not border + padding
  expect(mover.y - m.boxTop).toBeCloseTo(m.border, 1);
  expect(sib.x - m.boxLeft).toBeCloseTo(m.border + 320 + 8, 1);
  expect(sib.y - m.boxTop).toBeCloseTo(m.border + 150 + 4, 1);
});

test("the parent's visual centre: the guide and the snapped element sit on the padding-box centre", async ({ page }) => {
  const m = await metrics(page);
  const centre = m.boxLeft + m.border + m.clientWidth / 2;
  const mover = (await node(page, "mover").boundingBox())!;
  // Bring the mover's centre within ~2px of the padding-box centre.
  await dragMover(page, centre - (mover.x + mover.width / 2) + 2, 120);
  await expect(verticalGuide(page)).toBeVisible();
  const guide = (await verticalGuide(page).boundingBox())!;
  const live = (await node(page, "mover").boundingBox())!;
  expect(guide.x).toBeCloseTo(centre, 0);
  expect(live.x + live.width / 2).toBeCloseTo(centre, 1);
  await page.mouse.up();
  const after = (await node(page, "mover").boundingBox())!;
  expect(after.x + after.width / 2).toBeCloseTo(centre, 1);
});

test("a sibling with a margin: alignment uses its rendered edge, and the guide is drawn on it", async ({ page }) => {
  const sib = (await node(page, "sib").boundingBox())!;
  const mover = (await node(page, "mover").boundingBox())!;
  // Mover's left within ~3px of the sibling's rendered left edge, well below it.
  await dragMover(page, sib.x - mover.x + 3, 250);
  await expect(verticalGuide(page)).toBeVisible();
  const guide = (await verticalGuide(page).boundingBox())!;
  const live = (await node(page, "mover").boundingBox())!;
  expect(guide.x).toBeCloseTo(sib.x, 0);
  expect(live.x).toBeCloseTo(sib.x, 1);
  await page.mouse.up();
});

test("the padding-box edge the containment rule doesn't let the element reach shows no (false) guide", async ({ page }) => {
  const m = await metrics(page);
  const innerRight = m.boxLeft + m.border + m.clientWidth;
  const mover = (await node(page, "mover").boundingBox())!;
  // Push far right: containment stops the mover 40px (padding-right) before the inner edge.
  await dragMover(page, innerRight - (mover.x + mover.width) + 3, 60);
  const live = (await node(page, "mover").boundingBox())!;
  expect(live.x + live.width).toBeCloseTo(m.boxLeft + m.border + m.clientWidth - 40 - 20, 0); // content-box right (padding-left 20 + padding-right 40 = 60 less)
  const guides = await verticalGuide(page).count();
  if (guides > 0) {
    const guide = (await verticalGuide(page).boundingBox())!;
    expect(Math.abs(guide.x - innerRight)).toBeGreaterThan(1); // whatever it shows, never the unreachable inner edge
  }
  await page.mouse.up();
  await expect(horizontalGuide(page)).toHaveCount(0);
  await expect(verticalGuide(page)).toHaveCount(0);
});
