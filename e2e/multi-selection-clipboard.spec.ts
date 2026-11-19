import { expect, test, type Page } from "@playwright/test";
import type { EditorElementNode } from "../src/features/editor/types/document";
import { gotoApp } from "./support/gotoApp";
import { importDocument } from "./support/parityFixtures";

/*
 * BC-10.5 in the real browser: multi-element Copy / Paste (keyboard and
 * Edit menu), a parent and child copied once, cross-container Duplicate,
 * the multi-cut confirmation (Cancel, confirm, Undo), an interaction
 * remapped to the pasted target (checked in Preview), Save/Reopen, and
 * clipboard keys inside a text field staying the field's own.
 */

const SURFACE = "[data-document-surface]";
const document: EditorElementNode = {
  id: "page-root",
  tag: "page",
  children: [
    { id: "c-title", tag: "h1", text: "Title" },
    {
      id: "c-box",
      tag: "section",
      children: [
        { id: "c-a", tag: "p", text: "Alpha" },
        { id: "c-b", tag: "p", text: "Beta" },
      ],
    },
    { id: "c-z", tag: "p", text: "Zed" },
    { id: "c-go", tag: "button", text: "Toggle", interactions: [{ id: "c-i", trigger: "click", action: "toggle", targetId: "c-b" }] },
    { id: "c-dest", tag: "div", children: [] },
  ],
};

const element = (page: Page, id: string) => page.locator(`${SURFACE} [data-node-id="${id}"]`);
const surface = (page: Page) => page.locator(SURFACE).first();
const byText = (page: Page, text: string) => surface(page).getByText(text, { exact: true });
const cutDialog = (page: Page) => page.getByRole("dialog", { name: "Cut selected elements?" });

async function select(page: Page, ids: string[]) {
  await element(page, ids[0]).click({ position: { x: 4, y: 4 } });
  for (const id of ids.slice(1)) await element(page, id).click({ modifiers: ["ControlOrMeta"], position: { x: 4, y: 4 } });
}

async function editMenu(page: Page, item: string) {
  await page.getByRole("menuitem", { name: "Edit" }).click();
  await page.getByRole("menuitem", { name: new RegExp(`^${item}`) }).click();
}

test.beforeEach(async ({ page }) => {
  await gotoApp(page);
  await importDocument(page, document, "c-dest");
});

test("Copy two cross-container elements, paste them into one container in order; one Undo removes both", async ({ page }) => {
  await select(page, ["c-z", "c-a"]);
  await page.keyboard.press("ControlOrMeta+c");
  await select(page, ["c-dest"]);
  await editMenu(page, "Paste");
  const pasted = element(page, "c-dest").locator(":scope > [data-node-id]");
  await expect(pasted).toHaveCount(2);
  // Document order (Alpha before Zed), not selection order.
  await expect(pasted).toHaveText(["Alpha", "Zed"]);
  await expect(page.locator('[data-canvas-overlay="selection"]')).toHaveCount(2);
  await page.keyboard.press("ControlOrMeta+z");
  await expect(pasted).toHaveCount(0);
  await expect(byText(page, "Alpha")).toHaveCount(1);
});

test("A selected parent and its child are copied once (the whole parent)", async ({ page }) => {
  await select(page, ["c-box", "c-b"]);
  await page.keyboard.press("ControlOrMeta+c");
  await select(page, ["c-dest"]);
  await page.keyboard.press("ControlOrMeta+v");
  const pasted = element(page, "c-dest").locator(":scope > [data-node-id]");
  await expect(pasted).toHaveCount(1);
  await expect(pasted.locator("[data-node-id]")).toHaveText(["Alpha", "Beta"]);
  await expect(byText(page, "Beta")).toHaveCount(2);
});

test("Duplicate across containers: each copy right after its original", async ({ page }) => {
  await select(page, ["c-a", "c-z"]);
  await page.keyboard.press("ControlOrMeta+d");
  await expect(element(page, "c-box").locator(":scope > [data-node-id]")).toHaveText(["Alpha", "Alpha", "Beta"]);
  await expect(byText(page, "Zed")).toHaveCount(2);
  await page.keyboard.press("ControlOrMeta+z");
  await expect(byText(page, "Alpha")).toHaveCount(1);
  await expect(byText(page, "Zed")).toHaveCount(1);
});

test("Multi-cut asks first: Cancel changes nothing; Cut elements removes both; Undo restores; Paste puts them back", async ({ page }) => {
  await select(page, ["c-box", "c-z"]);
  await page.keyboard.press("ControlOrMeta+x");
  await expect(cutDialog(page)).toContainText("You are about to cut 2 selected elements. This will also remove 2 nested elements.");
  await cutDialog(page).getByRole("button", { name: "Cancel" }).click();
  await expect(cutDialog(page)).toBeHidden();
  await expect(element(page, "c-box")).toHaveCount(1);
  await expect(element(page, "c-z")).toHaveCount(1);

  await editMenu(page, "Cut");
  await cutDialog(page).getByRole("button", { name: "Cut elements" }).click();
  await expect(element(page, "c-box")).toHaveCount(0);
  await expect(element(page, "c-z")).toHaveCount(0);

  await page.keyboard.press("ControlOrMeta+z");
  await expect(element(page, "c-box")).toHaveCount(1);
  await expect(element(page, "c-z")).toHaveCount(1);
  await page.keyboard.press("ControlOrMeta+Shift+z");
  await expect(element(page, "c-box")).toHaveCount(0);

  await select(page, ["c-dest"]);
  await page.keyboard.press("ControlOrMeta+v");
  await expect(element(page, "c-dest").locator(":scope > [data-node-id]")).toHaveCount(2);
  await expect(byText(page, "Beta")).toHaveCount(1);
});

test("A copied trigger and its copied target: in Preview the pasted button toggles the pasted target, not the original; survives Save/Reopen", async ({ page }) => {
  await select(page, ["c-box", "c-go"]);
  await page.keyboard.press("ControlOrMeta+c");
  await select(page, ["c-dest"]);
  await page.keyboard.press("ControlOrMeta+v");
  const copies = element(page, "c-dest").locator(":scope > [data-node-id]");
  await expect(copies).toHaveCount(2);

  await page.keyboard.press("ControlOrMeta+s");
  const save = page.getByRole("dialog", { name: "Save Project" });
  const saved = page.locator('[data-project-status="saved"]');
  await expect(saved.or(save)).toBeVisible();
  if (await save.isVisible()) {
    await save.getByRole("textbox", { name: "Project name" }).fill("BC-10.5 clipboard");
    await save.getByRole("button", { name: "Save" }).click();
  }
  await expect(page.locator("[data-project-status]")).toHaveAttribute("data-project-status", "saved");
  await page.reload();
  await gotoApp(page);
  await page.keyboard.press("ControlOrMeta+o");
  const library = page.getByRole("dialog", { name: "Open Project" });
  await library.getByRole("button", { name: /^Open (BC-02\.5 parity|BC-10\.5 clipboard)$/ }).first().click();
  await expect(library).toBeHidden();
  const reopened = element(page, "c-dest").locator(":scope > [data-node-id]");
  await expect(reopened).toHaveCount(2);

  await page.getByRole("button", { name: "Enter Preview" }).click();
  const pastedButton = reopened.nth(1);
  const pastedBeta = reopened.nth(0).locator("[data-node-id]").nth(1);
  await expect(pastedBeta).toBeVisible();
  await pastedButton.click();
  await expect(pastedBeta).toBeHidden();
  await expect(element(page, "c-b")).toBeVisible();
});

test("Clipboard keys inside a text field stay the field's own, even with several elements selected", async ({ page }) => {
  await select(page, ["c-title", "c-z"]);
  const inspector = page.getByRole("complementary", { name: "Inspector panel" });
  const header = inspector.locator("button[aria-expanded]", { hasText: /^Typography$/ }).first();
  if ((await header.getAttribute("aria-expanded")) !== "true") await header.click();
  const field = inspector.getByRole("textbox", { name: "Font family" });
  await field.fill("Georgia");
  await field.press("ControlOrMeta+a");
  await field.press("ControlOrMeta+x");
  await expect(field).toHaveValue("");
  await expect(cutDialog(page)).toBeHidden();
  await field.press("ControlOrMeta+d");
  await expect(element(page, "c-title")).toHaveCount(1);
  await expect(byText(page, "Zed")).toHaveCount(1);
});
