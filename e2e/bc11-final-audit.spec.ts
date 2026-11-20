import { expect, test, type Page } from "@playwright/test";
import { gotoApp } from "./support/gotoApp";
import { importDocument } from "./support/parityFixtures";

/*
 * BC-11.4 final audit, real browser — the BC-11 workflows not already
 * covered end to end by e2e/css-clipboard*.spec.ts:
 * 2. section-only transfer (Typography) with the BC-10.3 Mixed state after Undo;
 * 4. layout transfer (Flex container settings + size) checked by real geometry
 *    on the Canvas, in Preview and in the export;
 * 6. persistence: global + section paste survive Save/Reopen; the CSS
 *    clipboard is session-only (gone after a reload).
 */

const SURFACE = "[data-document-surface]";
const px = (value: number) => ({ value, unit: "px" as const });
const inspector = (page: Page) => page.getByRole("complementary", { name: "Inspector panel" });
const element = (page: Page, id: string) => page.locator(`${SURFACE} [data-node-id="${id}"]`);
const button = (page: Page, name: string) => page.getByRole("button", { name, exact: true });

async function select(page: Page, ids: string[]) {
  await element(page, ids[0]).click({ position: { x: 4, y: 4 } });
  for (const id of ids.slice(1)) await element(page, id).click({ modifiers: ["ControlOrMeta"], position: { x: 4, y: 4 } });
}

async function sectionAction(page: Page, section: string, item: string) {
  await inspector(page).getByRole("button", { name: `${section} CSS actions` }).click();
  await page.getByRole("menuitem", { name: item, exact: true }).click();
}

async function openSection(page: Page, name: string) {
  const header = inspector(page).locator("button[aria-expanded]", { hasText: new RegExp(`^${name}$`) }).first();
  if ((await header.getAttribute("aria-expanded")) !== "true") await header.click();
}

test("2: Copy Typography CSS heading → paragraph keeps the paragraph's background/spacing/border; across a multi-selection, Mixed returns after Undo", async ({ page }) => {
  await gotoApp(page);
  await importDocument(
    page,
    {
      id: "page-root",
      tag: "page",
      children: [
        { id: "w-h", tag: "h2", text: "Heading", typography: { lineHeight: px(40), color: "#ff0000" } },
        { id: "w-p", tag: "p", text: "Para", typography: { lineHeight: px(20) }, background: { color: "#eeeeee" }, spacing: { padding: { top: 5, right: 5, bottom: 5, left: 5 } }, border: { top: { width: px(2), style: "solid", color: "#000000" } } },
      ],
    },
    "w-p",
  );
  await select(page, ["w-h"]);
  await sectionAction(page, "Typography", "Copy Typography CSS");
  await select(page, ["w-p"]);
  await sectionAction(page, "Typography", "Paste Typography CSS");
  await expect(element(page, "w-p")).toHaveCSS("line-height", "40px");
  await expect(element(page, "w-p")).toHaveCSS("color", "rgb(255, 0, 0)");
  await expect(element(page, "w-p")).toHaveCSS("background-color", "rgb(238, 238, 238)");
  await expect(element(page, "w-p")).toHaveCSS("padding-top", "5px");
  await expect(element(page, "w-p")).toHaveCSS("border-top-width", "2px");
  await button(page, "Undo").click();
  await expect(element(page, "w-p")).toHaveCSS("line-height", "20px");

  // Multi-selection: different line heights are Mixed; a section paste unifies them; Undo shows Mixed again.
  await select(page, ["w-p", "w-h"]);
  await openSection(page, "Typography");
  const lineHeight = inspector(page).getByRole("spinbutton", { name: "Line height" });
  await expect(lineHeight).toHaveAttribute("placeholder", "Mixed");
  await sectionAction(page, "Typography", "Paste Typography CSS");
  await expect(lineHeight).toHaveValue("40");
  await button(page, "Undo").click();
  await expect(lineHeight).toHaveAttribute("placeholder", "Mixed");
});

test("4: Flex container settings + size onto a block container: real geometry on Canvas and in Preview, Undo/Redo, export CSS", async ({ page }) => {
  await gotoApp(page);
  await importDocument(
    page,
    {
      id: "page-root",
      tag: "page",
      children: [
        { id: "l-src", tag: "div", flowLayout: { display: "flex", flex: { direction: "column", wrap: "nowrap", justifyContent: "start", alignItems: "start", rowGap: 24, columnGap: 0 } }, dimensions: { preferredWidth: 320, preferredHeight: 200, offsetX: 0, offsetY: 0 }, children: [] },
        { id: "l-dst", tag: "section", children: [{ id: "l-1", tag: "p", text: "One" }, { id: "l-2", tag: "p", text: "Two" }] },
      ],
    },
    "l-2",
  );
  const gap = async () => {
    const [one, two] = await Promise.all([element(page, "l-1").boundingBox(), element(page, "l-2").boundingBox()]);
    return Math.round(two!.y - (one!.y + one!.height));
  };
  await select(page, ["l-src"]);
  await page.keyboard.press("ControlOrMeta+Alt+c");
  await select(page, ["l-dst"]);
  await page.keyboard.press("ControlOrMeta+Alt+v");
  await expect(element(page, "l-dst")).toHaveCSS("display", "flex");
  await expect(element(page, "l-dst")).toHaveCSS("flex-direction", "column");
  await expect(element(page, "l-dst")).toHaveCSS("width", "320px");
  expect(await gap()).toBe(24);
  await button(page, "Undo").click();
  // A "block" container already renders as a flex column (resolveFlowLayoutStyle), so Undo is
  // checked on what the paste changed: the 24px row gap and the 320px width.
  await expect(element(page, "l-dst")).not.toHaveCSS("row-gap", "24px");
  await expect(element(page, "l-dst")).not.toHaveCSS("width", "320px");
  expect(await gap()).not.toBe(24);
  await button(page, "Redo").click();
  await expect(element(page, "l-dst")).toHaveCSS("row-gap", "24px");

  await button(page, "Enter Preview").click();
  await expect(element(page, "l-dst")).toHaveCSS("flex-direction", "column");
  expect(await gap()).toBe(24);
  await button(page, "Exit Preview").click();

  await page.getByRole("button", { name: "Export Code" }).click();
  const code = page.getByRole("dialog", { name: "Export Code" }).getByTestId("export-code");
  await expect(code).toBeVisible();
  const text = (await code.textContent()) ?? "";
  await page.keyboard.press("Escape");
  // Block containers export a flex column too, so the pasted rule is identified by its 24px row gap: source + destination.
  expect(text.match(/row-gap: 24px/g)?.length).toBe(2);
  expect(text).not.toMatch(/styleClipboard|sourceName/);
});

test("6: global and section pastes survive Save/Reopen; the CSS clipboard does not survive a reload", async ({ page }) => {
  await gotoApp(page);
  await importDocument(
    page,
    {
      id: "page-root",
      tag: "page",
      children: [
        { id: "p-a", tag: "button", text: "A", background: { color: "#2563eb" }, typography: { color: "#ffffff" } },
        { id: "p-b", tag: "button", text: "B" },
        { id: "p-c", tag: "p", text: "C" },
      ],
    },
    "p-c",
  );
  await select(page, ["p-a"]);
  await page.keyboard.press("ControlOrMeta+Alt+c");
  await select(page, ["p-b"]);
  await page.keyboard.press("ControlOrMeta+Alt+v");
  await select(page, ["p-c"]);
  await sectionAction(page, "Background", "Paste Background CSS");
  await expect(element(page, "p-c")).toHaveCSS("background-color", "rgb(37, 99, 235)");
  await expect(element(page, "p-c")).not.toHaveCSS("color", "rgb(255, 255, 255)");

  await page.keyboard.press("ControlOrMeta+s");
  const save = page.getByRole("dialog", { name: "Save Project" });
  await expect(page.locator('[data-project-status="saved"]').or(save)).toBeVisible();
  if (await save.isVisible()) {
    await save.getByRole("textbox", { name: "Project name" }).fill("BC-11.4 audit");
    await save.getByRole("button", { name: "Save" }).click();
  }
  await expect(page.locator("[data-project-status]")).toHaveAttribute("data-project-status", "saved");
  await page.reload();
  await gotoApp(page);
  await page.keyboard.press("ControlOrMeta+o");
  const library = page.getByRole("dialog", { name: "Open Project" });
  await library.getByRole("button", { name: /^Open (BC-02\.5 parity|BC-11\.4 audit)$/ }).first().click();
  await expect(library).toBeHidden();
  await expect(element(page, "p-b")).toHaveCSS("background-color", "rgb(37, 99, 235)");
  await expect(element(page, "p-b")).toHaveCSS("color", "rgb(255, 255, 255)");
  await expect(element(page, "p-c")).toHaveCSS("background-color", "rgb(37, 99, 235)");
  await expect(element(page, "p-b")).toHaveText("B");
  // Session-only: after the reload there is nothing to paste.
  await select(page, ["p-c"]);
  await page.keyboard.press("ControlOrMeta+Alt+v");
  await expect(page.getByText("Copy CSS from an element first.")).toBeVisible();
});
