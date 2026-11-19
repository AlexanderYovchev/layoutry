import { expect, test, type Page } from "@playwright/test";
import type { EditorElementNode } from "../src/features/editor/types/document";
import { gotoApp } from "./support/gotoApp";
import { importDocument } from "./support/parityFixtures";

/*
 * BC-11.2 in the real browser: Copy CSS from Button A, Paste CSS onto
 * Button B (and onto several elements), merge semantics, B keeps its own
 * content and interaction (Preview), one Undo/Redo, Copy CSS independent of
 * the element clipboard, and Canvas/Preview/Export parity.
 */

const SURFACE = "[data-document-surface]";
const px = (value: number) => ({ value, unit: "px" as const });
const document: EditorElementNode = {
  id: "page-root",
  tag: "page",
  children: [
    {
      id: "k-a",
      tag: "button",
      text: "Buy now",
      background: { color: "#2563eb" },
      typography: { color: "#ffffff" },
      borderRadius: { topLeft: px(8), topRight: px(8), bottomRight: px(8), bottomLeft: px(8) },
      spacing: { padding: { top: 12, right: 12, bottom: 12, left: 12 } },
    },
    {
      id: "k-b",
      tag: "button",
      text: "Cancel",
      background: { color: "#888888" },
      typography: { color: "#000000" },
      spacing: { padding: { top: 6, right: 6, bottom: 6, left: 6 } },
      boxShadow: [{ id: "l1", enabled: true, inset: false, offsetX: px(3), offsetY: px(3), blur: px(0), spread: px(0), color: "rgb(255, 0, 0)" }],
      interactions: [{ id: "k-i", trigger: "click", action: "toggle", targetId: "k-target" }],
    },
    { id: "k-target", tag: "p", text: "Target" },
    { id: "k-box", tag: "section", children: [{ id: "k-p", tag: "p", text: "Inside" }] },
  ],
};

const element = (page: Page, id: string) => page.locator(`${SURFACE} [data-node-id="${id}"]`);
const button = (page: Page, name: string) => page.getByRole("button", { name, exact: true });

async function select(page: Page, ids: string[]) {
  await element(page, ids[0]).click({ position: { x: 4, y: 4 } });
  for (const id of ids.slice(1)) await element(page, id).click({ modifiers: ["ControlOrMeta"], position: { x: 4, y: 4 } });
}

async function expectButtonALook(page: Page, id: string) {
  const target = element(page, id);
  await expect(target).toHaveCSS("background-color", "rgb(37, 99, 235)");
  await expect(target).toHaveCSS("color", "rgb(255, 255, 255)");
  await expect(target).toHaveCSS("border-top-left-radius", "8px");
  await expect(target).toHaveCSS("padding-top", "12px");
}

test.beforeEach(async ({ page }) => {
  await gotoApp(page);
  await importDocument(page, document, "k-p");
});

test("Copy CSS from A, Paste CSS onto B: B takes A's look, keeps its text, shadow and interaction; one Undo/Redo; Preview and Export agree", async ({ page }) => {
  await select(page, ["k-a"]);
  await page.keyboard.press("ControlOrMeta+Alt+c");
  await expect(page.getByText("CSS copied from Button.")).toBeVisible();
  await select(page, ["k-b"]);
  await page.keyboard.press("ControlOrMeta+Alt+v");
  await expectButtonALook(page, "k-b");
  await expect(element(page, "k-b")).toHaveText("Cancel");
  // Merge: B's own shadow (absent on A) stays.
  await expect(element(page, "k-b")).toHaveCSS("box-shadow", "rgb(255, 0, 0) 3px 3px 0px 0px");

  await button(page, "Undo").click();
  await expect(element(page, "k-b")).toHaveCSS("background-color", "rgb(136, 136, 136)");
  await expect(element(page, "k-b")).toHaveCSS("padding-top", "6px");
  await button(page, "Redo").click();
  await expectButtonALook(page, "k-b");

  await button(page, "Enter Preview").click();
  await expectButtonALook(page, "k-b");
  await element(page, "k-b").click();
  await expect(element(page, "k-target")).toBeHidden();
  await button(page, "Exit Preview").click();

  await page.getByRole("button", { name: "Export Code" }).click();
  const code = page.getByRole("dialog", { name: "Export Code" }).getByTestId("export-code");
  await expect(code).toBeVisible();
  const text = (await code.textContent()) ?? "";
  await page.keyboard.press("Escape");
  expect(text.match(/background-color: #2563eb/g)?.length).toBe(2);
  expect(text).toContain("Cancel");
});

test("Paste CSS onto several elements (Edit menu): text elements take it all, the section skips Typography with a notice", async ({ page }) => {
  await select(page, ["k-a"]);
  await page.getByRole("menuitem", { name: "Edit" }).click();
  await page.getByRole("menuitem", { name: /^Copy CSS/ }).click();
  await select(page, ["k-target", "k-box", "k-p"]);
  await page.getByRole("menuitem", { name: "Edit" }).click();
  await page.getByRole("menuitem", { name: /^Paste CSS/ }).click();
  for (const id of ["k-target", "k-p"]) await expect(element(page, id)).toHaveCSS("color", "rgb(255, 255, 255)");
  for (const id of ["k-target", "k-box", "k-p"]) await expect(element(page, id)).toHaveCSS("background-color", "rgb(37, 99, 235)");
  await expect(page.getByText("CSS pasted. Skipped: Typography.")).toBeVisible();
  await button(page, "Undo").click();
  for (const id of ["k-target", "k-box", "k-p"]) await expect(element(page, id)).not.toHaveCSS("background-color", "rgb(37, 99, 235)");
});

test("the CSS clipboard and the element clipboard are independent", async ({ page }) => {
  await select(page, ["k-b"]);
  await page.keyboard.press("ControlOrMeta+c");
  await select(page, ["k-a"]);
  await page.keyboard.press("ControlOrMeta+Alt+c");
  await select(page, ["k-box"]);
  await page.keyboard.press("ControlOrMeta+v");
  const pasted = element(page, "k-box").locator(":scope > [data-node-id]").nth(1);
  await expect(pasted).toHaveText("Cancel");
  await expect(pasted).toHaveCSS("background-color", "rgb(136, 136, 136)");
  // The pasted copy is selected: Paste CSS restyles it with A's look.
  await page.keyboard.press("ControlOrMeta+Alt+v");
  await expect(pasted).toHaveCSS("background-color", "rgb(37, 99, 235)");
  await expect(pasted).toHaveText("Cancel");
  // The element clipboard still holds B.
  await select(page, ["k-box"]);
  await page.keyboard.press("ControlOrMeta+v");
  await expect(element(page, "k-box").locator(":scope > [data-node-id]").nth(2)).toHaveCSS("background-color", "rgb(136, 136, 136)");
});
