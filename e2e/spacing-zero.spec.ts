import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import type { EditorElementNode } from "../src/features/editor/types/document";
import { gotoApp } from "./support/gotoApp";
import { canvasNode, computed, selectOnCanvas } from "./support/inspector";
import { importDocument } from "./support/parityFixtures";

/*
 * BC-05.3 — spacing zero-value semantics in the real editor: an authored
 * padding/margin of 0 is applied on the Canvas, in Preview and in Export,
 * survives save/reopen and Undo/Redo, and Reset removes it so the
 * element's own default spacing returns. Old (format 1) projects keep
 * their appearance.
 */

const inspector = (page: Page) => page.getByRole("complementary", { name: "Inspector panel" });
const undo = (page: Page) => page.getByRole("button", { name: "Undo", exact: true }).click();
const redo = (page: Page) => page.getByRole("button", { name: "Redo", exact: true }).click();
const resetButton = (page: Page, name: string) => inspector(page).getByRole("button", { name, exact: true });
const SIDES = ["top", "right", "bottom", "left"] as const;

async function paddingOf(page: Page, id: string): Promise<string[]> {
  return Promise.all(SIDES.map((side) => computed(page, id, `padding-${side}`)));
}

async function marginOf(page: Page, id: string): Promise<string[]> {
  return Promise.all(SIDES.map((side) => computed(page, id, `margin-${side}`)));
}

/** The Spacing group's side field (Margin's come first, Padding's last). */
function sideField(page: Page, side: "Top" | "Right" | "Bottom" | "Left", group: "Margin" | "Padding") {
  const fields = inspector(page).getByLabel(side, { exact: true });
  return group === "Margin" ? fields.first() : fields.last();
}

async function typeInto(page: Page, field: ReturnType<Page["locator"]>, value: string) {
  await field.click();
  await field.press("Control+a");
  await page.keyboard.type(value);
  await page.keyboard.press("Enter");
}

async function exportedCode(page: Page): Promise<string> {
  await page.getByRole("button", { name: "Export Code" }).click();
  const code = page.getByRole("dialog", { name: "Export Code" }).getByTestId("export-code");
  await expect(code).toBeVisible();
  const text = (await code.textContent()) ?? "";
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Export Code" })).toHaveCount(0);
  return text;
}

interface ExportedElement {
  /** The declarations of the element's own generated rule (`.ly-node-N`), or "" when it has none. */
  rule: string;
  padding: string[];
  margin: string[];
}

/**
 * Opens the exported standalone page and reads each element (found by its
 * exported `id`, the node's htmlId): its own rule's declarations, and the
 * spacing the exported page actually computes for it.
 */
async function exported(page: Page, code: string, ids: readonly string[]): Promise<Record<string, ExportedElement>> {
  const exportedPage = await page.context().newPage();
  await exportedPage.setContent(code);
  const result = await exportedPage.evaluate(
    ({ ids, sides, css }) =>
      Object.fromEntries(
        ids.map((id) => {
          const element = document.getElementById(id);
          if (!element) return [id, { rule: "missing", padding: [], margin: [] }];
          const nodeClass = Array.from(element.classList).find((name) => /^ly-node-\d+$/.test(name));
          const rule = nodeClass ? (new RegExp(`\\.${nodeClass}\\s*\\{([^}]*)\\}`).exec(css)?.[1] ?? "") : "";
          const style = getComputedStyle(element);
          return [
            id,
            {
              rule,
              padding: sides.map((side) => style.getPropertyValue(`padding-${side}`)),
              margin: sides.map((side) => style.getPropertyValue(`margin-${side}`)),
            },
          ];
        }),
      ),
    { ids: [...ids], sides: [...SIDES], css: code },
  );
  await exportedPage.close();
  return result;
}

function spacingDocument(): EditorElementNode {
  return {
    id: "page-root",
    tag: "page",
    children: [
      { id: "cta", htmlId: "cta", tag: "button", text: "Call to action" },
      { id: "title", htmlId: "title", tag: "h2", text: "A heading" },
      { id: "body", htmlId: "body", tag: "p", text: "A paragraph of text." },
      {
        id: "box",
        htmlId: "box",
        tag: "div",
        flowLayout: { display: "block" },
        // Taller than its child, so there is always empty box to click (see selectBox).
        dimensions: { preferredWidth: 400, preferredHeight: 160, offsetX: 0, offsetY: 0 },
        spacing: { padding: { top: 24, right: 24, bottom: 24, left: 24 } },
        children: [{ id: "inside", tag: "p", text: "Inside" }],
      },
    ],
  };
}

/** Selects the container by its empty lower edge: with padding 0, its child covers the top-left corner selectOnCanvas clicks. */
async function selectBox(page: Page) {
  const box = await canvasNode(page, "box").boundingBox();
  if (!box) throw new Error("no box");
  await canvasNode(page, "box").click({ position: { x: 5, y: box.height - 5 } });
}

async function start(page: Page) {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await gotoApp(page);
  await importDocument(page, spacingDocument(), "inside");
}

test.describe("BC-05.3 spacing zero", () => {
  test("button padding 0: Canvas, Reset, Undo/Redo, Preview, Export and save/reopen", async ({ page }) => {
    await start(page);
    const defaultPadding = await paddingOf(page, "cta");
    expect(defaultPadding, "the button renders its own default padding").not.toEqual(["0px", "0px", "0px", "0px"]);

    await selectOnCanvas(page, "cta");
    // An unset padding shows what the button renders, not 0, and nothing is resettable.
    await expect(sideField(page, "Top", "Padding")).toHaveValue(defaultPadding[0].replace("px", ""));
    await expect(sideField(page, "Left", "Padding")).toHaveValue(defaultPadding[3].replace("px", ""));
    await expect(resetButton(page, "Reset padding")).toBeDisabled();

    // Link the four sides and author 0.
    await inspector(page).getByRole("button", { name: "Unlinked" }).last().click();
    await typeInto(page, inspector(page).getByLabel("Padding (all sides)", { exact: true }), "0");
    expect(await paddingOf(page, "cta")).toEqual(["0px", "0px", "0px", "0px"]);
    await expect(resetButton(page, "Reset padding")).toBeEnabled();

    const zero = (await exported(page, await exportedCode(page), ["cta"])).cta;
    for (const side of SIDES) expect(zero.rule).toContain(`padding-${side}: 0;`);
    expect(zero.padding, "the exported page applies the zero").toEqual(["0px", "0px", "0px", "0px"]);

    await page.getByRole("button", { name: "Enter Preview" }).click();
    expect(await paddingOf(page, "cta")).toEqual(["0px", "0px", "0px", "0px"]);
    await page.getByRole("button", { name: "Exit Preview" }).click();

    await selectOnCanvas(page, "cta");
    await resetButton(page, "Reset padding").click();
    expect(await paddingOf(page, "cta"), "the default padding returns").toEqual(defaultPadding);
    await expect(resetButton(page, "Reset padding")).toBeDisabled();
    const reset = (await exported(page, await exportedCode(page), ["cta"])).cta;
    expect(reset.rule).not.toMatch(/padding-(top|right|bottom|left)/);
    expect(reset.padding, "the exported page shows the default padding again").toEqual(defaultPadding);

    await undo(page);
    expect(await paddingOf(page, "cta")).toEqual(["0px", "0px", "0px", "0px"]);
    await redo(page);
    expect(await paddingOf(page, "cta")).toEqual(defaultPadding);
    await undo(page);

    // Save with the authored 0 (an imported project is already in the library, so Ctrl+S saves it in place), reload, reopen: still 0, still resettable.
    await expect(page.getByText("Unsaved changes", { exact: true })).toBeVisible();
    await page.keyboard.press("Control+s");
    await expect(page.getByText("Unsaved changes", { exact: true })).toHaveCount(0);
    await page.reload();
    await gotoApp(page);
    await page.keyboard.press("Control+o");
    await page.getByRole("dialog", { name: "Open Project" }).getByRole("button", { name: "Open BC-02.5 parity" }).click();
    await canvasNode(page, "cta").waitFor();
    expect(await paddingOf(page, "cta")).toEqual(["0px", "0px", "0px", "0px"]);
    await selectOnCanvas(page, "cta");
    await expect(resetButton(page, "Reset padding")).toBeEnabled();
    await expect(inspector(page).getByLabel("Padding (all sides)", { exact: true })).toHaveValue("0");
  });

  test("heading and paragraph margin 0, container padding 0, and mixed sides", async ({ page }) => {
    await start(page);
    const ids = ["title", "body", "box", "cta"] as const;
    const before = await exported(page, await exportedCode(page), ids);
    expect(before.title.rule).not.toMatch(/margin-/);

    await selectOnCanvas(page, "title");
    await typeInto(page, inspector(page).getByLabel("Margin (all sides)", { exact: true }), "0");
    await expect(resetButton(page, "Reset margin")).toBeEnabled();
    await selectOnCanvas(page, "body");
    await typeInto(page, inspector(page).getByLabel("Margin (all sides)", { exact: true }), "0");
    await selectBox(page);
    await typeInto(page, inspector(page).getByLabel("Padding (all sides)", { exact: true }), "0");
    expect(await paddingOf(page, "box")).toEqual(["0px", "0px", "0px", "0px"]);

    // Mixed: only the button's left padding is authored.
    await selectOnCanvas(page, "cta");
    const defaultPadding = await paddingOf(page, "cta");
    await typeInto(page, sideField(page, "Left", "Padding"), "0");
    expect(await paddingOf(page, "cta")).toEqual([defaultPadding[0], defaultPadding[1], defaultPadding[2], "0px"]);
    await expect(resetButton(page, "Reset padding left")).toBeEnabled();
    await expect(resetButton(page, "Reset padding top")).toBeDisabled();

    const code = await exported(page, await exportedCode(page), ids);
    for (const id of ["title", "body"] as const) for (const side of SIDES) expect(code[id].rule).toContain(`margin-${side}: 0;`);
    for (const side of SIDES) expect(code.box.rule).toContain(`padding-${side}: 0;`);
    expect(code.cta.rule).toContain("padding-left: 0;");
    expect(code.cta.rule).not.toMatch(/padding-(top|right|bottom):/);
    expect(await marginOf(page, "title")).toEqual(["0px", "0px", "0px", "0px"]);
    // The exported page computes what the Canvas computes.
    expect(code.title.margin).toEqual(await marginOf(page, "title"));
    expect(code.box.padding).toEqual(await paddingOf(page, "box"));
    expect(code.cta.padding).toEqual(await paddingOf(page, "cta"));

    // Preview agrees with the Canvas for every element.
    const design = [await marginOf(page, "title"), await paddingOf(page, "box"), await paddingOf(page, "cta")];
    await page.getByRole("button", { name: "Enter Preview" }).click();
    expect([await marginOf(page, "title"), await paddingOf(page, "box"), await paddingOf(page, "cta")]).toEqual(design);
    await page.getByRole("button", { name: "Exit Preview" }).click();

    // Keyboard: Enter on the side's reset removes it and keeps focus on that side's field.
    await selectOnCanvas(page, "cta");
    await resetButton(page, "Reset padding left").focus();
    await page.keyboard.press("Enter");
    await expect(sideField(page, "Left", "Padding")).toBeFocused();
    expect(await paddingOf(page, "cta")).toEqual(defaultPadding);

    // Resetting the remaining zeros brings the export back to where it started.
    for (const id of ["title", "body"]) {
      await selectOnCanvas(page, id);
      await resetButton(page, "Reset margin").click();
    }
    await selectBox(page);
    await resetButton(page, "Reset padding").click();
    // The container keeps its spacing record, so no legacy default padding comes back.
    expect(await paddingOf(page, "box")).toEqual(["0px", "0px", "0px", "0px"]);
    const after = await exported(page, await exportedCode(page), ids);
    for (const id of ["title", "body", "cta"] as const) expect(after[id]).toEqual(before[id]);
  });

  test("keyboard-only authoring and the narrowest Inspector width", async ({ page }) => {
    await start(page);
    await selectOnCanvas(page, "cta");
    const field = sideField(page, "Right", "Padding");
    await field.focus();
    await page.keyboard.press("Control+a");
    await page.keyboard.type("0");
    await page.keyboard.press("Enter");
    expect(await computed(page, "cta", "padding-right")).toBe("0px");

    const handle = page.getByRole("separator", { name: "Resize Inspector Panel" });
    const box = await handle.boundingBox();
    if (!box) throw new Error("no handle");
    await page.mouse.move(box.x + box.width / 2, box.y + 300);
    await page.mouse.down();
    await page.mouse.move(1599, box.y + 300, { steps: 10 });
    await page.mouse.up();
    await expect(handle).toHaveAttribute("aria-valuenow", (await handle.getAttribute("aria-valuemin")) ?? "");

    const overflow = await inspector(page).evaluate((panel) => {
      const bounds = panel.getBoundingClientRect();
      return Array.from(panel.querySelectorAll<HTMLElement>("[data-inspector-reset-scope] input, [data-inspector-reset]:not(:disabled)"))
        .filter((element) => element.getClientRects().length > 0)
        .filter((element) => {
          const rect = element.getBoundingClientRect();
          return rect.right > bounds.right + 0.5 || rect.left < bounds.left - 0.5;
        })
        .map((element) => element.getAttribute("aria-label") ?? element.tagName);
    });
    expect(overflow, "every Spacing field and reset stays inside the Inspector").toEqual([]);
    await expect(resetButton(page, "Reset padding right")).toBeVisible();
  });

  test("a format 1 project keeps its appearance, and its old zeros are not resettable overrides", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await gotoApp(page);
    const bytes = readFileSync(path.join(process.cwd(), "test", "fixtures", "persistence", "project-1.1-every-element.layoutry"));
    await page.getByTestId("project-import-input").setInputFiles({ name: "legacy.layoutry", mimeType: "application/json", buffer: bytes });
    // A container saved with all-zero spacing: format 1 rendered it with no padding (no default either).
    await canvasNode(page, "div-367df6a5").waitFor({ state: "attached" });
    expect(await paddingOf(page, "div-367df6a5")).toEqual(["0px", "0px", "0px", "0px"]);
    // A button with padding 10/20 and zero margin keeps both.
    expect(await paddingOf(page, "button-d59ed1af")).toEqual(["10px", "20px", "10px", "20px"]);
    expect(await marginOf(page, "button-d59ed1af")).toEqual(["0px", "0px", "0px", "0px"]);

    await selectOnCanvas(page, "button-d59ed1af");
    await expect(resetButton(page, "Reset padding")).toBeEnabled();
    await expect(resetButton(page, "Reset margin"), "a format 1 zero margin was never a declaration").toBeDisabled();
  });
});
