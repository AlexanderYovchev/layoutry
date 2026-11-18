import { expect, test, type Page } from "@playwright/test";
import type { EditorElementNode } from "../src/features/editor/types/document";
import { gotoApp } from "./support/gotoApp";
import { importDocument } from "./support/parityFixtures";

/*
 * BC-10.2 in the real browser: Structure panel Shift range and Ctrl toggle
 * stay in sync with the Canvas outlines and the Inspector; every
 * multi-delete asks first (keyboard and Edit menu), Cancel and Escape
 * change nothing, confirming is one Undo step; a single delete doesn't ask.
 */

const SURFACE = "[data-document-surface]";
const document: EditorElementNode = {
  id: "page-root",
  tag: "page",
  children: [
    { id: "t-title", tag: "h1", text: "Title", displayName: "Title" },
    {
      id: "t-box",
      tag: "section",
      displayName: "Box",
      children: [
        { id: "t-a", tag: "p", text: "Alpha", displayName: "Alpha" },
        { id: "t-b", tag: "p", text: "Beta", displayName: "Beta" },
      ],
    },
    { id: "t-z", tag: "p", text: "Zed", displayName: "Zed" },
  ],
};

const tree = (page: Page) => page.getByRole("tree", { name: "Page structure" });
const row = (page: Page, name: string) => tree(page).getByRole("treeitem", { name: new RegExp(`^(Collapse |Expand )?${name}`) }).first();
const outlines = (page: Page) => page.locator('[data-canvas-overlay="selection"]');
const dialog = (page: Page) => page.getByRole("dialog", { name: "Delete selected elements?" });
const exists = (page: Page, id: string) => page.locator(`${SURFACE} [data-node-id="${id}"]`);

async function open(page: Page) {
  await gotoApp(page);
  await importDocument(page, document, "t-z");
  await page.getByRole("tab", { name: "Structure" }).click();
}

test("Structure Shift range and Ctrl toggle drive the Canvas outlines, the count and the Inspector", async ({ page }) => {
  await open(page);
  await row(page, "Title").click();
  await row(page, "Beta").click({ modifiers: ["Shift"] });
  await expect(outlines(page)).toHaveCount(4);
  await expect(page.locator("[data-structure-selection-count]")).toHaveText("4 selected");
  await expect(page.getByRole("complementary", { name: "Inspector panel" }).getByText("4 elements selected").first()).toBeVisible();
  for (const name of ["Title", "Box", "Alpha", "Beta"]) await expect(row(page, name)).toHaveAttribute("aria-selected", "true");
  await expect(row(page, "Zed")).toHaveAttribute("aria-selected", "false");

  await row(page, "Alpha").click({ modifiers: ["ControlOrMeta"] });
  await expect(outlines(page)).toHaveCount(3);
  await expect(page.locator("[data-structure-selection-count]")).toHaveText("3 selected");

  // Canvas → Structure, and a click on blank Canvas clears both.
  await exists(page, "t-z").click();
  await expect(row(page, "Zed")).toHaveAttribute("aria-selected", "true");
  await expect(outlines(page)).toHaveCount(1);
  await expect(page.locator("[data-structure-selection-count]")).toHaveText("");
  await page.keyboard.press("Escape");
  await expect(outlines(page)).toHaveCount(0);
});

test("Delete with two or more selected asks first; Cancel and Escape change nothing; confirming is one Undo step", async ({ page }) => {
  await open(page);
  await row(page, "Box").click();
  await row(page, "Zed").click({ modifiers: ["ControlOrMeta"] });
  const undo = page.getByRole("button", { name: "Undo", exact: true });
  await expect(undo).toBeDisabled();

  await page.keyboard.press("Delete");
  await expect(dialog(page)).toBeVisible();
  await expect(dialog(page)).toContainText("You are about to delete 2 selected elements. This will also remove 2 nested elements inside them.");
  await expect(dialog(page).getByRole("button", { name: "Cancel" })).toBeFocused();
  await dialog(page).getByRole("button", { name: "Cancel" }).click();
  await expect(dialog(page)).toBeHidden();
  await expect(exists(page, "t-box")).toBeAttached();
  await expect(undo).toBeDisabled();
  await expect(outlines(page)).toHaveCount(2);

  await page.keyboard.press("Backspace");
  await expect(dialog(page)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog(page)).toBeHidden();
  await expect(exists(page, "t-z")).toBeAttached();

  // Edit › Delete asks too; confirming deletes both subtrees.
  await page.getByRole("menuitem", { name: "Edit" }).click();
  await page.getByRole("menuitem", { name: "Delete" }).click();
  await dialog(page).getByRole("button", { name: "Delete elements" }).click();
  await expect(dialog(page)).toBeHidden();
  for (const id of ["t-box", "t-a", "t-b", "t-z"]) await expect(exists(page, id)).toHaveCount(0);
  await expect(exists(page, "t-title")).toBeAttached();

  // One Undo restores all four; Undo is then exhausted.
  await undo.click();
  for (const id of ["t-box", "t-a", "t-b", "t-z"]) await expect(exists(page, id)).toBeAttached();
  await expect(undo).toBeDisabled();
});

test("a single selected element is deleted at once, with no dialog", async ({ page }) => {
  await open(page);
  await row(page, "Zed").click();
  await page.keyboard.press("Delete");
  await expect(dialog(page)).toHaveCount(0);
  await expect(exists(page, "t-z")).toHaveCount(0);
});
