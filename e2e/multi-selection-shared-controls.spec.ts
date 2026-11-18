import { expect, test, type Page } from "@playwright/test";
import type { EditorElementNode } from "../src/features/editor/types/document";
import { gotoApp } from "./support/gotoApp";
import { importDocument } from "./support/parityFixtures";

/*
 * BC-10.4 in the real browser: shared CSS edits from the multi-selection
 * Inspector render on every selected element (Canvas and Preview), as one
 * Undo step, through the fanned-out single-selection sections, the
 * complete bulk fields (with Reset) and the Mixed panels.
 */

const SURFACE = "[data-document-surface]";
const px = (value: number) => ({ value, unit: "px" as const });
const document: EditorElementNode = {
  id: "page-root",
  tag: "page",
  children: [
    { id: "s-p1", tag: "p", text: "First paragraph" },
    { id: "s-p2", tag: "p", text: "Second paragraph" },
    { id: "s-h", tag: "h2", text: "Heading", typography: { lineHeight: px(40) } },
    { id: "s-p3", tag: "p", text: "Third paragraph", typography: { lineHeight: px(20) } },
    { id: "s-b1", tag: "button", text: "One", boxShadow: [{ id: "l1", enabled: true, inset: false, offsetX: px(1), offsetY: px(1), blur: px(2), spread: px(0), color: "rgba(0, 0, 0, 0.5)" }] },
    { id: "s-b2", tag: "button", text: "Two", boxShadow: [{ id: "l2", enabled: true, inset: false, offsetX: px(6), offsetY: px(6), blur: px(0), spread: px(0), color: "rgb(255, 0, 0)" }] },
  ],
};

const inspector = (page: Page) => page.getByRole("complementary", { name: "Inspector panel" });
const element = (page: Page, id: string) => page.locator(`${SURFACE} [data-node-id="${id}"]`);
const undo = (page: Page) => page.getByRole("button", { name: "Undo", exact: true });

async function select(page: Page, ids: string[]) {
  await element(page, ids[0]).click({ position: { x: 4, y: 4 } });
  for (const id of ids.slice(1)) await element(page, id).click({ modifiers: ["ControlOrMeta"], position: { x: 4, y: 4 } });
}

async function openSection(page: Page, name: string) {
  const header = inspector(page).locator("button[aria-expanded]", { hasText: new RegExp(`^${name}$`) }).first();
  if ((await header.getAttribute("aria-expanded")) !== "true") await header.click();
}

test.beforeEach(async ({ page }) => {
  await gotoApp(page);
  await importDocument(page, document, "s-b2");
});

test("two paragraphs: the single-selection Typography edits both (Canvas and Preview); one Undo restores both", async ({ page }) => {
  await select(page, ["s-p1", "s-p2"]);
  await openSection(page, "Typography");
  await inspector(page).locator("button[aria-pressed]", { hasText: /^Italic$/ }).first().click();
  for (const id of ["s-p1", "s-p2"]) await expect(element(page, id)).toHaveCSS("font-style", "italic");
  await page.getByRole("button", { name: "Enter Preview" }).click();
  for (const id of ["s-p1", "s-p2"]) await expect(element(page, id)).toHaveCSS("font-style", "italic");
  await page.getByRole("button", { name: "Exit Preview" }).click();
  await undo(page).click();
  for (const id of ["s-p1", "s-p2"]) await expect(element(page, id)).toHaveCSS("font-style", "normal");
});

test("a heading and a paragraph: Mixed line height, Reset clears both, then one typed value sets both", async ({ page }) => {
  await select(page, ["s-h", "s-p3"]);
  await openSection(page, "Typography");
  const lineHeight = inspector(page).getByRole("spinbutton", { name: "Line height" });
  await expect(lineHeight).toHaveAttribute("placeholder", "Mixed");
  await inspector(page).getByRole("button", { name: "Reset line height on all selected elements" }).click();
  // Defaults differ by tag, so it may stay Mixed after Reset: that is the truth, not forced.
  await expect(element(page, "s-p3")).not.toHaveCSS("line-height", "20px");
  await lineHeight.fill("28");
  await lineHeight.press("Enter");
  for (const id of ["s-h", "s-p3"]) await expect(element(page, id)).toHaveCSS("line-height", "28px");
  await undo(page).click();
  await expect(lineHeight).not.toHaveValue("28");
});

test("buttons with different shadows: Mixed panel, adopt the primary's, both render it", async ({ page }) => {
  await select(page, ["s-b1", "s-b2"]);
  await openSection(page, "Box Shadow");
  await expect(inspector(page).getByText("Mixed.")).toBeVisible();
  await inspector(page).getByRole("button", { name: /^Use .*'s shadows on all$/ }).click();
  const first = await element(page, "s-b1").evaluate((node) => getComputedStyle(node).boxShadow);
  await expect(element(page, "s-b2")).toHaveCSS("box-shadow", first);
  expect(first).toContain("rgb(255, 0, 0)");
  // Now the real Box Shadow editor is shown for both.
  await expect(inspector(page).getByText("Mixed.")).toHaveCount(0);
});
