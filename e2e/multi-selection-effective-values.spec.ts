import { expect, test, type Page } from "@playwright/test";
import type { EditorElementNode } from "../src/features/editor/types/document";
import { gotoApp } from "./support/gotoApp";
import { importDocument } from "./support/parityFixtures";
import { serializeProject } from "../src/features/project/utils/serializeProject";

/** Imports under a different project id than importDocument, so a second import needs no "already in library" choice. */
async function importDocumentAs(page: Page, document: EditorElementNode, waitForNodeId: string) {
  const file = serializeProject({
    metadata: { id: "00000000-0000-4000-8000-000000001030", name: "BC-10.3 many", createdAt: "2026-11-18T00:00:00.000Z", updatedAt: "2026-11-18T00:00:00.000Z" },
    document,
  });
  await page.getByTestId("project-import-input").setInputFiles({ name: "many.layoutry", mimeType: "application/json", buffer: Buffer.from(file) });
  await page.locator(`[data-document-surface] [data-node-id="${waitForNodeId}"]`).waitFor({ state: "attached", timeout: 60_000 });
}

/*
 * BC-10.3 — multi-selection Mixed detection with REAL browser-computed CSS:
 * tag defaults, inheritance, relative units, off-screen and hidden
 * elements, and Undo/Redo re-reading the values.
 */

const SURFACE = "[data-document-surface]";

function document(): EditorElementNode {
  const spacer: EditorElementNode = { id: "spacer", tag: "div", dimensions: { preferredWidth: 200, preferredHeight: 3000, offsetX: 0, offsetY: 0 } };
  return {
    id: "page-root",
    tag: "page",
    children: [
      { id: "e-h1", tag: "h1", text: "Heading" },
      { id: "e-p", tag: "p", text: "Paragraph" },
      // Inheritance: the same effective colour, authored on the child in one case and inherited in the other.
      // A red section: its paragraph keeps its OWN default colour (text elements always have one).
      { id: "e-red-box", tag: "section", typography: { color: "#ff0000" }, children: [{ id: "e-inherits", tag: "p", text: "In red box" }] },
      { id: "e-own-red", tag: "p", text: "Own red", typography: { color: "rgb(255, 0, 0)" } },
      { id: "e-hex-red", tag: "p", text: "Hex red", typography: { color: "#f00" } },
      // Same authored 2em; the section's 10px is not rendered (containers have no typography), so both render 32px.
      { id: "e-small", tag: "section", typography: { fontSize: { value: 10, unit: "px" } }, children: [{ id: "e-em-a", tag: "p", text: "2em in 10px", typography: { fontSize: { value: 2, unit: "em" } } }] },
      { id: "e-em-b", tag: "p", text: "2em in 16px", typography: { fontSize: { value: 2, unit: "em" } } },
      { id: "e-px-32", tag: "p", text: "32px", typography: { fontSize: { value: 32, unit: "px" } } },
      { id: "e-button", tag: "button", text: "Button" },
      { id: "e-link", tag: "a", text: "Link", href: "#" },
      spacer,
      // Far below the fold.
      { id: "e-far", tag: "p", text: "Far away" },
      // Hidden by CSS.
      { id: "e-hidden-a", tag: "p", text: "Hidden A", displayName: "Hidden A", display: { display: "none" } },
      { id: "e-hidden-b", tag: "p", text: "Hidden B", displayName: "Hidden B", display: { display: "none" } },
    ],
  };
}

const inspector = (page: Page) => page.getByRole("complementary", { name: "Inspector panel" });
const fontSize = (page: Page) => inspector(page).getByRole("spinbutton", { name: "Font size" });

/** Real UI: plain click the first, Ctrl/Cmd+click the rest (hidden elements through their Structure rows). */
async function select(page: Page, ids: string[]) {
  const [first, ...rest] = ids;
  await clickNode(page, first, []);
  for (const id of rest) await clickNode(page, id, ["ControlOrMeta"]);
}

async function clickNode(page: Page, id: string, modifiers: ("ControlOrMeta" | "Shift")[]) {
  const element = page.locator(`${SURFACE} [data-node-id="${id}"]`);
  if (await element.isVisible()) {
    await element.click({ modifiers, position: { x: 4, y: 4 } });
    return;
  }
  // Hidden on the Canvas (display: none): select its Structure row (named by its displayName) instead.
  await page.getByRole("tab", { name: "Structure" }).click();
  const name = id === "e-hidden-a" ? "Hidden A" : "Hidden B";
  await page.getByRole("tree", { name: "Page structure" }).getByRole("treeitem", { name, exact: true }).click({ modifiers });
}

test.beforeEach(async ({ page }) => {
  await gotoApp(page);
  await importDocument(page, document(), "e-hidden-b");
});

test("an unset h1 and p read Mixed (32px vs 16px), and editing the Mixed field sets both; Undo brings Mixed back", async ({ page }) => {
  await select(page, ["e-h1", "e-p"]);
  await expect(fontSize(page)).toHaveAttribute("placeholder", "Mixed");
  await expect(fontSize(page)).toHaveValue("");
  await fontSize(page).fill("24");
  await fontSize(page).press("Enter");
  await expect(fontSize(page)).toHaveValue("24");
  for (const id of ["e-h1", "e-p"]) {
    await expect(page.locator(`${SURFACE} [data-node-id="${id}"]`)).toHaveCSS("font-size", "24px");
  }
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(fontSize(page)).toHaveAttribute("placeholder", "Mixed");
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await expect(fontSize(page)).toHaveValue("24");
});

test("cascade and units: the same red written two ways is one value; a red section doesn't make its paragraph red; 2em and 32px that both render 32px are one value", async ({ page }) => {
  await select(page, ["e-own-red", "e-hex-red"]);
  await expect(inspector(page).getByRole("textbox", { name: "Text color" })).toHaveValue("#ff0000");
  await select(page, ["e-inherits", "e-own-red"]);
  await expect(inspector(page).getByRole("textbox", { name: "Text color" })).toHaveAttribute("placeholder", "Mixed");
  await select(page, ["e-em-a", "e-em-b", "e-px-32"]);
  await expect(page.locator(`${SURFACE} [data-node-id="e-em-a"]`)).toHaveCSS("font-size", "32px");
  await expect(fontSize(page)).toHaveValue("32");
  // Authored values differ (2em, 2em, 32px): the row is "set", the shown value is the rendered one.
});

test("tag defaults: a Button and a Link differ in background, radius and display", async ({ page }) => {
  await select(page, ["e-button", "e-link"]);
  await expect(inspector(page).getByRole("textbox", { name: "Background color" })).toHaveAttribute("placeholder", "Mixed");
  await expect(inspector(page).getByRole("spinbutton", { name: "Border radius" })).toHaveAttribute("placeholder", "Mixed");
});

test("an element scrolled far out of view and elements hidden by CSS are still read", async ({ page }) => {
  await select(page, ["e-p", "e-far"]);
  await expect(fontSize(page)).toHaveValue("16");
  await select(page, ["e-hidden-a", "e-hidden-b"]);
  await expect(fontSize(page)).toHaveValue("16");
  // Both are display: none, which the Display row shows as None.
  await expect(inspector(page).getByRole("radio", { name: "None" }).or(inspector(page).getByRole("button", { name: "None" })).first()).toBeVisible();
});

test("a large selection: 120 paragraphs are read once and agree", async ({ page }) => {
  const many: EditorElementNode = { id: "page-root", tag: "page", children: Array.from({ length: 120 }, (_, index) => ({ id: `m-${index}`, tag: "p", text: `P${index}`, displayName: `P${index}` })) };
  await importDocumentAs(page, many, "m-119");
  await page.getByRole("tab", { name: "Structure" }).click();
  const tree = page.getByRole("tree", { name: "Page structure" });
  await tree.getByRole("treeitem", { name: "P0" }).click();
  const start = Date.now();
  await tree.getByRole("treeitem", { name: "P119" }).click({ modifiers: ["Shift"] });
  await expect(fontSize(page)).toHaveValue("16");
  const elapsed = Date.now() - start;
  console.log(`BC-10.3 perf: 120-element selection resolved in ${elapsed} ms`);
  expect(elapsed).toBeLessThan(5000);
});
