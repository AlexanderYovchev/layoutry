import { expect, test, type Page } from "@playwright/test";
import type { EditorElementNode } from "../src/features/editor/types/document";
import { gotoApp } from "./support/gotoApp";
import { canvasNode, computed, selectOnCanvas } from "./support/inspector";
import { importDocument } from "./support/parityFixtures";

/*
 * BC-05.4 — final BC-05 regression in the real editor:
 * - multi-selection Spacing shows each element's EFFECTIVE spacing (shared
 *   value or Mixed), and editing a Mixed field writes only the typed value;
 * - Width/Height have one "Reset size";
 * - a Canvas / Preview / exported-page parity matrix over the BC-05 resets
 *   (spacing zero, unset button padding, reset margin, Flex, Grid,
 *   Transform component, combined size), including save/reopen.
 */

const SIDES = ["top", "right", "bottom", "left"] as const;
const inspector = (page: Page) =>
  page.getByRole("complementary", { name: "Inspector panel" });
const resetButton = (page: Page, name: string) =>
  inspector(page).getByRole("button", { name, exact: true });
const undo = (page: Page) =>
  page.getByRole("button", { name: "Undo", exact: true }).click();

async function openSection(page: Page, name: string) {
  const header = inspector(page).getByRole("button", { name, exact: true });
  if ((await header.getAttribute("aria-expanded")) !== "true")
    await header.click();
  await expect(header).toHaveAttribute("aria-expanded", "true");
}

async function typeInto(page: Page, label: string, value: string) {
  const field = inspector(page).getByLabel(label, { exact: true });
  await field.click();
  await field.press("Control+a");
  await page.keyboard.type(value);
  await page.keyboard.press("Enter");
}

async function addToSelection(page: Page, id: string) {
  await canvasNode(page, id).click({
    position: { x: 5, y: 5 },
    modifiers: ["Control"],
  });
}

async function exportedCode(page: Page): Promise<string> {
  await page.getByRole("button", { name: "Export Code" }).click();
  const code = page
    .getByRole("dialog", { name: "Export Code" })
    .getByTestId("export-code");
  await expect(code).toBeVisible();
  const text = (await code.textContent()) ?? "";
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Export Code" })).toHaveCount(
    0,
  );
  return text;
}

/** The computed values of `properties` for every element, by id: on the Canvas (data-node-id) or in a page (id). */
async function read(
  page: Page,
  ids: readonly string[],
  properties: readonly string[],
  attribute: "data-node-id" | "id",
): Promise<Record<string, string[]>> {
  return page.evaluate(
    ({ ids, properties, attribute }) =>
      Object.fromEntries(
        ids.map((id) => {
          const element = document.querySelector(
            attribute === "id"
              ? `#${id}`
              : `[data-document-surface] [data-node-id="${id}"]`,
          );
          if (!element) return [id, ["missing"]];
          const style = getComputedStyle(element);
          return [
            id,
            properties.map((property) => style.getPropertyValue(property)),
          ];
        }),
      ),
    { ids: [...ids], properties: [...properties], attribute },
  );
}

const button = (
  id: string,
  spacing?: EditorElementNode["spacing"],
): EditorElementNode => ({ id, htmlId: id, tag: "button", text: id, spacing });

test.describe("BC-05.4 multi-selection effective spacing", () => {
  test("shared value, Mixed, authored-vs-unset, and editing a Mixed field", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await gotoApp(page);
    await importDocument(
      page,
      {
        id: "page-root",
        tag: "page",
        children: [
          button("b1"),
          button("b2"),
          { id: "h", htmlId: "h", tag: "h2", text: "Heading" },
          {
            id: "p",
            htmlId: "p",
            tag: "p",
            text: "Paragraph",
            spacing: { padding: { top: 0, right: 0, bottom: 0, left: 0 } },
          },
        ],
      },
      "p",
    );

    // Two buttons with their own unset 8 / 16 padding: Mixed (not 0).
    await selectOnCanvas(page, "b1");
    await addToSelection(page, "b2");
    await openSection(page, "Spacing");
    await expect(
      inspector(page).getByLabel("Padding", { exact: true }),
    ).toHaveAttribute("placeholder", "Mixed");
    await expect(
      inspector(page).getByLabel("Padding", { exact: true }),
    ).toHaveValue("");
    await expect(
      inspector(page).getByLabel("Margin", { exact: true }),
    ).toHaveValue("0");

    // Heading (unset, renders 0) + paragraph (authored 0): both compute 0 → 0, and the row says something is set.
    await selectOnCanvas(page, "h");
    await addToSelection(page, "p");
    await openSection(page, "Spacing");
    await expect(
      inspector(page).getByLabel("Padding", { exact: true }),
    ).toHaveValue("0");
    const paddingRow = inspector(page)
      .locator("[data-inspector-reset-scope]")
      .filter({ has: page.getByLabel("Padding", { exact: true }) })
      .last();
    await expect(paddingRow.getByText("Explicitly set")).toHaveCount(1);

    // Editing the buttons' Mixed padding writes exactly 4 to every side of both, one Undo step.
    await selectOnCanvas(page, "b1");
    await addToSelection(page, "b2");
    await openSection(page, "Spacing");
    await typeInto(page, "Padding", "4");
    for (const id of ["b1", "b2"])
      for (const side of SIDES)
        expect(await computed(page, id, `padding-${side}`)).toBe("4px");
    await expect(
      inspector(page).getByLabel("Padding", { exact: true }),
    ).toHaveValue("4");
    expect(await computed(page, "b1", "margin-top"), "margin untouched").toBe(
      "0px",
    );
    await undo(page);
    expect(await computed(page, "b1", "padding-left")).not.toBe("4px");
  });
});

test.describe("BC-05.4 width and height", () => {
  test("one Reset size for the pair, explained, keyboard focus on Width", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await gotoApp(page);
    await importDocument(
      page,
      {
        id: "page-root",
        tag: "page",
        children: [
          {
            id: "box",
            htmlId: "box",
            tag: "div",
            flowLayout: { display: "block" },
            spacing: {},
            dimensions: {
              preferredWidth: 300,
              preferredHeight: 120,
              offsetX: 0,
              offsetY: 0,
            },
            children: [],
          },
        ],
      },
      "box",
    );
    await selectOnCanvas(page, "box");
    await openSection(page, "Size");
    await expect(
      inspector(page).getByRole("button", { name: /^Reset (width|height)/ }),
    ).toHaveCount(0);
    const reset = resetButton(page, "Reset size");
    await expect(reset).toHaveCount(1);
    await expect(reset).toHaveAttribute(
      "title",
      "Reset width and height together.",
    );
    expect(await computed(page, "box", "width")).toBe("300px");

    await reset.focus();
    await page.keyboard.press("Enter");
    await expect(
      inspector(page).getByLabel("Width", { exact: true }),
    ).toBeFocused();
    expect(await computed(page, "box", "height")).not.toBe("120px");
    await expect(
      inspector(page).getByLabel("Width", { exact: true }),
    ).toHaveValue("");
    await undo(page);
    expect(await computed(page, "box", "width")).toBe("300px");
  });
});

function matrixDocument(): EditorElementNode {
  return {
    id: "page-root",
    tag: "page",
    children: [
      button("unsetButton"),
      button("zeroButton"),
      button("mixedButton", { padding: { left: 0 } }),
      {
        id: "resetHeading",
        htmlId: "resetHeading",
        tag: "h2",
        text: "Reset heading",
        spacing: { margin: { top: 0, right: 0, bottom: 24, left: 0 } },
      },
      {
        id: "flexBox",
        htmlId: "flexBox",
        tag: "div",
        spacing: { padding: { top: 8, right: 8, bottom: 8, left: 8 } },
        flowLayout: {
          display: "flex",
          flex: {
            direction: "column",
            wrap: "wrap",
            justifyContent: "center",
            alignItems: "center",
            rowGap: 8,
            columnGap: 20,
          },
        },
        children: [
          { id: "flexItem", htmlId: "flexItem", tag: "p", text: "Flex item" },
        ],
      },
      {
        id: "gridBox",
        htmlId: "gridBox",
        tag: "div",
        spacing: { padding: { top: 8, right: 8, bottom: 8, left: 8 } },
        flowLayout: {
          display: "grid",
          grid: { columns: 4, rows: "auto", rowGap: 16, columnGap: 16 },
        },
        children: [
          { id: "gridItem", htmlId: "gridItem", tag: "p", text: "Cell" },
        ],
      },
      {
        id: "sized",
        htmlId: "sized",
        tag: "div",
        flowLayout: { display: "block" },
        spacing: {},
        dimensions: {
          preferredWidth: 300,
          preferredHeight: 120,
          offsetX: 0,
          offsetY: 0,
        },
        children: [],
      },
      // Last, with room above: rotated and scaled, it would cover its neighbours' click points.
      {
        id: "turned",
        htmlId: "turned",
        tag: "h3",
        text: "Turned",
        spacing: { margin: { top: 80 } },
        transform: { rotateDeg: 20, scale: 1.5 },
      },
    ],
  };
}

const MATRIX_PROPERTIES = [
  ...SIDES.map((side) => `padding-${side}`),
  ...SIDES.map((side) => `margin-${side}`),
  "flex-direction",
  "column-gap",
  "transform",
  "height",
] as const;
const MATRIX_IDS = [
  "unsetButton",
  "zeroButton",
  "mixedButton",
  "resetHeading",
  "flexBox",
  "gridBox",
  "turned",
  "sized",
] as const;

test.describe("BC-05.4 Canvas / Preview / Export parity matrix", () => {
  test("after the BC-05 resets, Canvas, Preview, the exported page and a reopened project compute the same CSS", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 1600, height: 1000 });
    await gotoApp(page);
    await importDocument(page, matrixDocument(), "sized");

    // Author and reset through the Inspector.
    await selectOnCanvas(page, "zeroButton");
    await inspector(page)
      .getByRole("button", { name: "Unlinked", exact: true })
      .last()
      .click();
    await typeInto(page, "Padding (all sides)", "0");
    await selectOnCanvas(page, "resetHeading");
    await resetButton(page, "Reset margin").click();
    await selectOnCanvas(page, "flexBox");
    await openSection(page, "Content Layout");
    await resetButton(page, "Reset direction").click();
    await resetButton(page, "Reset gap").click();
    await selectOnCanvas(page, "gridBox");
    await openSection(page, "Content Layout");
    await resetButton(page, "Reset columns").click();
    // Rotated: its corner point is outside the rotated shape, so click its centre.
    await canvasNode(page, "turned").click();
    await openSection(page, "Transform");
    await resetButton(page, "Reset rotate").click();
    await selectOnCanvas(page, "sized");
    await openSection(page, "Size");
    await resetButton(page, "Reset size").click();

    const canvas = await read(
      page,
      MATRIX_IDS,
      MATRIX_PROPERTIES,
      "data-node-id",
    );
    // Spot checks of the intended outcomes.
    expect(canvas.zeroButton.slice(0, 4)).toEqual(["0px", "0px", "0px", "0px"]);
    expect(canvas.unsetButton.slice(0, 4)).not.toEqual([
      "0px",
      "0px",
      "0px",
      "0px",
    ]);
    expect(canvas.mixedButton[3]).toBe("0px");
    expect(canvas.mixedButton[0]).toBe(canvas.unsetButton[0]);
    expect(canvas.resetHeading.slice(4, 8)).toEqual([
      "0px",
      "0px",
      "0px",
      "0px",
    ]);
    expect(canvas.flexBox[8]).toBe("row");
    expect(canvas.flexBox[9]).toBe("0px");
    expect(canvas.sized[11]).not.toBe("120px");

    // Preview.
    await page.getByRole("button", { name: "Enter Preview" }).click();
    expect(
      await read(page, MATRIX_IDS, MATRIX_PROPERTIES, "data-node-id"),
    ).toEqual(canvas);
    await page.getByRole("button", { name: "Exit Preview" }).click();

    // The exported page (standalone HTML) loaded on its own, same viewport.
    const code = await exportedCode(page);
    expect(code).not.toMatch(/:\s*(initial|unset|revert)\s*;/);
    const exportedPage = await page.context().newPage();
    await exportedPage.setViewportSize({ width: 1600, height: 1000 });
    await exportedPage.setContent(code);
    const exported = await read(
      exportedPage,
      MATRIX_IDS,
      MATRIX_PROPERTIES,
      "id",
    );
    await exportedPage.close();
    // Height of the auto-sized box depends only on its (empty) content, so it is comparable too.
    expect(exported).toEqual(canvas);

    // Grid: the reset template is the default 2 equal columns everywhere.
    expect(
      await canvasNode(page, "gridBox").evaluate(
        (element) => (element as HTMLElement).style.gridTemplateColumns,
      ),
    ).toMatch(/^repeat\(2, minmax\(0(px)?, 1fr\)\)$/);
    expect(code).toContain("repeat(2, minmax(0, 1fr))");

    // Save, reload, reopen: the same CSS again.
    await page.keyboard.press("Control+s");
    await expect(
      page.getByText("Unsaved changes", { exact: true }),
    ).toHaveCount(0);
    await page.reload();
    await gotoApp(page);
    await page.keyboard.press("Control+o");
    await page
      .getByRole("dialog", { name: "Open Project" })
      .getByRole("button", { name: "Open BC-02.5 parity" })
      .click();
    await canvasNode(page, "sized").waitFor();
    expect(
      await read(page, MATRIX_IDS, MATRIX_PROPERTIES, "data-node-id"),
    ).toEqual(canvas);
  });
});
