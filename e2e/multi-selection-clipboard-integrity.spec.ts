import { expect, test, type Page } from "@playwright/test";
import type { EditorElementNode } from "../src/features/editor/types/document";
import { gotoApp } from "./support/gotoApp";
import { importDocument } from "./support/parityFixtures";

/*
 * BC-10.5.1 in the real browser: Free-layout copies pasted together keep
 * their rendered arrangement, and a duplicated authored HTML id stays
 * unique in the live page.
 */

const SURFACE = "[data-document-surface]";
const element = (page: Page, id: string) => page.locator(`${SURFACE} [data-node-id="${id}"]`);
const surface = (page: Page) => page.locator(SURFACE).first();

async function select(page: Page, ids: string[]) {
  await element(page, ids[0]).click({ position: { x: 4, y: 4 } });
  for (const id of ids.slice(1)) await element(page, id).click({ modifiers: ["ControlOrMeta"], position: { x: 4, y: 4 } });
}


const freeDocument: EditorElementNode = {
  id: "page-root",
  tag: "page",
  children: [
    {
      id: "g-from",
      tag: "div",
      layoutMode: "free",
      dimensions: { preferredWidth: 500, preferredHeight: 260, offsetX: 0, offsetY: 0 },
      children: [
        { id: "g-1", tag: "p", text: "Gee one", freeLayout: { x: 20, y: 30, width: 100, height: 40 } },
        { id: "g-2", tag: "p", text: "Gee two", freeLayout: { x: 200, y: 90, width: 120, height: 40 } },
      ],
    },
    { id: "g-to", tag: "div", layoutMode: "free", dimensions: { preferredWidth: 500, preferredHeight: 260, offsetX: 0, offsetY: 0 }, children: [] },
    { id: "g-hero", tag: "section", htmlId: "hero", children: [{ id: "g-h", tag: "h2", text: "Hero" }] },
  ],
};

test.beforeEach(async ({ page }) => {
  await gotoApp(page);
  await importDocument(page, freeDocument, "g-hero");
});

test("Free-layout copies pasted together keep their rendered arrangement", async ({ page }) => {
  const delta = async (a: string, b: string) => {
    const [boxA, boxB] = await Promise.all([page.locator(`${SURFACE} [data-node-id="${a}"]`).boundingBox(), page.locator(`${SURFACE} [data-node-id="${b}"]`).boundingBox()]);
    return { x: Math.round(boxB!.x - boxA!.x), y: Math.round(boxB!.y - boxA!.y) };
  };
  const original = await delta("g-1", "g-2");
  await select(page, ["g-1", "g-2"]);
  await page.keyboard.press("ControlOrMeta+c");
  await select(page, ["g-to"]);
  await page.keyboard.press("ControlOrMeta+v");
  const copies = element(page, "g-to").locator(":scope > [data-node-id]");
  await expect(copies).toHaveCount(2);
  const [a, b] = await copies.evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-node-id")!));
  expect(await delta(a, b)).toEqual(original);
});

test("a duplicated element with an authored id: the id stays unique in the live page", async ({ page }) => {
  await select(page, ["g-hero", "g-1"]);
  await page.keyboard.press("ControlOrMeta+d");
  await expect(surface(page).locator('[id="hero"]')).toHaveCount(1);
  await expect(surface(page).locator('[id="hero-copy"]')).toHaveCount(1);
});
