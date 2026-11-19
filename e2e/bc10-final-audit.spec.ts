import { expect, test, type Page } from "@playwright/test";
import { gotoApp } from "./support/gotoApp";
import { importDocument } from "./support/parityFixtures";

/*
 * BC-10.6 final audit, real browser: the BC-10 features exercised TOGETHER.
 * A: Canvas + Structure selection → Mixed → shared edit → Undo → Redo.
 * C: multi-cut → Escape → Edit-menu cut → confirm → Undo (interaction works in Preview) → Paste.
 * D: multi-duplicate → bulk Reset on the copies only → Save/Reopen.
 */

const SURFACE = "[data-document-surface]";
const px = (value: number) => ({ value, unit: "px" as const });
const element = (page: Page, id: string) => page.locator(`${SURFACE} [data-node-id="${id}"]`);
const inspector = (page: Page) => page.getByRole("complementary", { name: "Inspector panel" });
const tree = (page: Page) => page.getByRole("tree", { name: "Page structure" });
const row = (page: Page, name: string) => tree(page).getByRole("treeitem", { name: new RegExp(`^(Collapse |Expand )?${name}`) }).first();
const button = (page: Page, name: string) => page.getByRole("button", { name, exact: true });
const children = (page: Page, id: string) => element(page, id).locator(":scope > [data-node-id]");

async function openSection(page: Page, name: string) {
  const header = inspector(page).locator("button[aria-expanded]", { hasText: new RegExp(`^${name}$`) }).first();
  if ((await header.getAttribute("aria-expanded")) !== "true") await header.click();
}

async function select(page: Page, ids: string[]) {
  await element(page, ids[0]).click({ position: { x: 4, y: 4 } });
  for (const id of ids.slice(1)) await element(page, id).click({ modifiers: ["ControlOrMeta"], position: { x: 4, y: 4 } });
}

test("A: Canvas + Structure multi-select across containers → Mixed → one shared edit → Undo → Redo", async ({ page }) => {
  await gotoApp(page);
  await importDocument(
    page,
    {
      id: "page-root",
      tag: "page",
      children: [
        { id: "a-box", tag: "section", displayName: "Box", children: [{ id: "a-h", tag: "h2", text: "Head", displayName: "Head", typography: { lineHeight: px(40) } }] },
        { id: "a-wrap", tag: "div", displayName: "Wrap", children: [{ id: "a-p", tag: "p", text: "Para", displayName: "Para", typography: { lineHeight: px(20) } }] },
      ],
    },
    "a-p",
  );
  await element(page, "a-h").click({ position: { x: 4, y: 4 } });
  await page.getByRole("tab", { name: "Structure" }).click();
  await row(page, "Para").click({ modifiers: ["ControlOrMeta"] });
  await expect(page.locator("[data-structure-selection-count]")).toHaveText("2 selected");
  await expect(page.locator('[data-canvas-overlay="selection"]')).toHaveCount(2);
  for (const name of ["Head", "Para"]) await expect(row(page, name)).toHaveAttribute("aria-selected", "true");

  await openSection(page, "Typography");
  const lineHeight = inspector(page).getByRole("spinbutton", { name: "Line height" });
  await expect(lineHeight).toHaveAttribute("placeholder", "Mixed");
  await lineHeight.fill("28");
  await lineHeight.press("Enter");
  for (const id of ["a-h", "a-p"]) await expect(element(page, id)).toHaveCSS("line-height", "28px");
  await button(page, "Undo").click();
  await expect(element(page, "a-h")).toHaveCSS("line-height", "40px");
  await expect(element(page, "a-p")).toHaveCSS("line-height", "20px");
  await expect(lineHeight).toHaveAttribute("placeholder", "Mixed");
  await button(page, "Redo").click();
  for (const id of ["a-h", "a-p"]) await expect(element(page, id)).toHaveCSS("line-height", "28px");
});

test("C: multi-cut → Escape → Edit-menu cut → confirm → Undo restores the interaction (Preview) → Paste gives fresh copies", async ({ page }) => {
  await gotoApp(page);
  await importDocument(
    page,
    {
      id: "page-root",
      tag: "page",
      children: [
        { id: "c-box", tag: "section", children: [{ id: "c-a", tag: "p", text: "Alpha" }, { id: "c-b", tag: "p", text: "Beta" }] },
        { id: "c-z", tag: "p", text: "Zed" },
        { id: "c-go", tag: "button", text: "Toggle", interactions: [{ id: "c-i", trigger: "click", action: "toggle", targetId: "c-b" }] },
        { id: "c-dest", tag: "div", children: [] },
      ],
    },
    "c-dest",
  );
  const dialog = page.getByRole("dialog", { name: "Cut selected elements?" });
  await select(page, ["c-box", "c-z"]);
  await page.keyboard.press("ControlOrMeta+x");
  await expect(dialog).toContainText("You are about to cut 2 selected elements. This will also remove 2 nested elements.");
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(element(page, "c-box")).toHaveCount(1);
  await expect(button(page, "Undo")).toBeDisabled();

  await page.getByRole("menuitem", { name: "Edit" }).click();
  await page.getByRole("menuitem", { name: /^Cut/ }).click();
  await dialog.getByRole("button", { name: "Cut elements" }).click();
  await expect(element(page, "c-box")).toHaveCount(0);
  await expect(element(page, "c-z")).toHaveCount(0);
  await button(page, "Undo").click();
  await expect(element(page, "c-b")).toHaveCount(1);

  await button(page, "Enter Preview").click();
  await expect(element(page, "c-b")).toBeVisible();
  await element(page, "c-go").click();
  await expect(element(page, "c-b")).toBeHidden();
  await button(page, "Exit Preview").click();

  await select(page, ["c-dest"]);
  await page.keyboard.press("ControlOrMeta+v");
  await expect(children(page, "c-dest")).toHaveCount(2);
  const ids = await page.locator(`${SURFACE} [data-node-id]`).evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-node-id")));
  expect(new Set(ids).size).toBe(ids.length);
});

test("D: multi-duplicate → bulk Reset on the copies only → Save/Reopen keeps it; nothing selected after reopening", async ({ page }) => {
  await gotoApp(page);
  await importDocument(
    page,
    {
      id: "page-root",
      tag: "page",
      children: [
        {
          id: "d-row",
          tag: "div",
          children: [
            { id: "d-1", tag: "button", text: "One", spacing: { padding: { top: 20, right: 20, bottom: 20, left: 20 } } },
            { id: "d-2", tag: "button", text: "Two", spacing: { padding: { top: 30, right: 30, bottom: 30, left: 30 } } },
          ],
        },
      ],
    },
    "d-2",
  );
  await select(page, ["d-1", "d-2"]);
  await page.keyboard.press("ControlOrMeta+d");
  await expect(children(page, "d-row")).toHaveCount(4);
  const [, copy1, , copy2] = await children(page, "d-row").evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-node-id")!));
  await expect(page.locator('[data-canvas-overlay="selection"]')).toHaveCount(2);
  await openSection(page, "Spacing");
  await inspector(page).getByRole("button", { name: "Reset padding on all selected elements" }).first().click();
  for (const id of [copy1, copy2]) await expect(element(page, id)).not.toHaveCSS("padding-top", /^(20|30)px$/);
  await expect(element(page, "d-1")).toHaveCSS("padding-top", "20px");
  await expect(element(page, "d-2")).toHaveCSS("padding-top", "30px");

  await page.keyboard.press("ControlOrMeta+s");
  const save = page.getByRole("dialog", { name: "Save Project" });
  await expect(page.locator('[data-project-status="saved"]').or(save)).toBeVisible();
  if (await save.isVisible()) {
    await save.getByRole("textbox", { name: "Project name" }).fill("BC-10.6 audit");
    await save.getByRole("button", { name: "Save" }).click();
  }
  await expect(page.locator("[data-project-status]")).toHaveAttribute("data-project-status", "saved");
  await page.reload();
  await gotoApp(page);
  await page.keyboard.press("ControlOrMeta+o");
  const library = page.getByRole("dialog", { name: "Open Project" });
  await library.getByRole("button", { name: /^Open (BC-02\.5 parity|BC-10\.6 audit)$/ }).first().click();
  await expect(library).toBeHidden();
  await expect(children(page, "d-row")).toHaveCount(4);
  await expect(element(page, "d-1")).toHaveCSS("padding-top", "20px");
  await expect(element(page, copy1)).not.toHaveCSS("padding-top", "20px");
  await expect(element(page, copy2)).not.toHaveCSS("padding-top", "30px");
  await expect(page.locator('[data-canvas-overlay="selection"]')).toHaveCount(0);
});
