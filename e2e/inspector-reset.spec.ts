import { expect, test, type Locator, type Page } from "@playwright/test";
import type { EditorElementNode } from "../src/features/editor/types/document";
import { gotoApp } from "./support/gotoApp";
import { canvasNode, computed, selectOnCanvas } from "./support/inspector";
import { importDocument } from "./support/parityFixtures";

/*
 * BC-05.2 — CSS reset in the real editor: representative properties from
 * Typography, Transform, Background, Border, Layout (Flex/Grid), Flex item
 * and Grid item are authored, reset (pointer and keyboard), undone, redone,
 * previewed, exported and saved/reopened; a reset while typing is one Undo
 * step; keyboard focus stays in the Inspector; nothing escapes the panel at
 * its narrowest width.
 */

const inspector = (page: Page) =>
  page.getByRole("complementary", { name: "Inspector panel" });
const undo = (page: Page) =>
  page.getByRole("button", { name: "Undo", exact: true }).click();
const redo = (page: Page) =>
  page.getByRole("button", { name: "Redo", exact: true }).click();
const resetButton = (page: Page, name: string) =>
  inspector(page).getByRole("button", { name, exact: true });

/** The innermost reset scope (row) holding a label. */
function row(page: Page, label: string): Locator {
  return inspector(page)
    .locator("[data-inspector-reset-scope]")
    .filter({ has: page.getByText(label, { exact: true }) })
    .last();
}

async function openSection(page: Page, name: string) {
  const header = inspector(page).getByRole("button", { name, exact: true });
  if ((await header.getAttribute("aria-expanded")) !== "true")
    await header.click();
  await expect(header).toHaveAttribute("aria-expanded", "true");
}

async function setField(page: Page, label: string, value: string) {
  const field = inspector(page).getByLabel(label, { exact: true });
  await field.click();
  await field.press("Control+a");
  await page.keyboard.type(value);
  await page.keyboard.press("Enter");
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

async function focusedLabel(page: Page): Promise<string> {
  return page.evaluate(() => {
    const active = document.activeElement as HTMLElement | null;
    if (!active || active === document.body) return "BODY";
    return (
      active.getAttribute("aria-label") ??
      active.textContent?.trim() ??
      active.tagName
    );
  });
}

async function start(page: Page) {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await gotoApp(page);
}

test.describe("BC-05.2 CSS reset", () => {
  test("Typography: author, reset, Undo/Redo, Preview, Export and save/reopen", async ({
    page,
  }) => {
    await start(page);
    const original = await exportedCode(page);
    await selectOnCanvas(page, "heading-1");
    await openSection(page, "Typography");
    await expect(resetButton(page, "Reset font size")).toBeDisabled();

    await setField(page, "Font size", "40");
    await setField(page, "Letter spacing", "2");
    await expect(resetButton(page, "Reset font size")).toBeEnabled();
    expect(await computed(page, "heading-1", "font-size")).toBe("40px");

    await resetButton(page, "Reset font size").click();
    expect(await computed(page, "heading-1", "font-size")).toBe("30px");
    await expect(resetButton(page, "Reset font size")).toBeDisabled();
    expect(
      await computed(page, "heading-1", "letter-spacing"),
      "letter spacing untouched",
    ).toBe("2px");

    await undo(page);
    expect(await computed(page, "heading-1", "font-size")).toBe("40px");
    await redo(page);
    expect(await computed(page, "heading-1", "font-size")).toBe("30px");

    await resetButton(page, "Reset letter spacing").click();
    expect(
      await exportedCode(page),
      "Export after both resets equals the untouched page",
    ).toBe(original);

    await page.getByRole("button", { name: "Enter Preview" }).click();
    expect(await computed(page, "heading-1", "font-size")).toBe("30px");
    await page.getByRole("button", { name: "Exit Preview" }).click();

    // Save, reload, reopen: the reset state persists (Font size back to the rendered 30, nothing to reset).
    await selectOnCanvas(page, "heading-1");
    await setField(page, "Font size", "44");
    await resetButton(page, "Reset font size").click();
    await page.keyboard.press("Control+s");
    const dialog = page.getByRole("dialog", { name: "Save Project" });
    await dialog
      .getByRole("textbox", { name: "Project name" })
      .fill("Reset project");
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(dialog).toHaveCount(0);
    await page.reload();
    await gotoApp(page);
    await page.keyboard.press("Control+o");
    await page
      .getByRole("dialog", { name: "Open Project" })
      .getByRole("button", { name: "Open Reset project" })
      .click();
    await canvasNode(page, "heading-1").waitFor();
    await selectOnCanvas(page, "heading-1");
    await openSection(page, "Typography");
    await expect(
      inspector(page).getByLabel("Font size", { exact: true }),
    ).toHaveValue("30");
    await expect(resetButton(page, "Reset font size")).toBeDisabled();
    // (The export title now carries the project name, so compare the declaration, not the whole file.)
    const reopened = await exportedCode(page);
    expect(reopened).not.toContain("font-size: 44px");
    expect(reopened).not.toContain("font-size: 40px");
  });

  test("Reset while typing is one Undo step; keyboard reset keeps focus in the row", async ({
    page,
  }) => {
    await start(page);
    await selectOnCanvas(page, "heading-1");
    await openSection(page, "Typography");
    await setField(page, "Font size", "40");

    // Typing 55 (live), then pressing Reset with the pointer: the draft is discarded.
    const field = inspector(page).getByLabel("Font size", { exact: true });
    await field.click();
    await field.press("Control+a");
    await page.keyboard.type("55");
    expect(await computed(page, "heading-1", "font-size")).toBe("55px");
    await resetButton(page, "Reset font size").click();
    expect(await computed(page, "heading-1", "font-size")).toBe("30px");
    await expect(field).toHaveValue("30");
    await undo(page);
    expect(
      await computed(page, "heading-1", "font-size"),
      "one Undo returns to the committed 40, never to the draft",
    ).toBe("40px");
    await undo(page);
    expect(await computed(page, "heading-1", "font-size")).toBe("30px");
    await redo(page);
    expect(await computed(page, "heading-1", "font-size")).toBe("40px");

    // Keyboard: Enter on Reset → focus lands on the Font size field, not <body>; Shift+Tab and Tab move on from there.
    await resetButton(page, "Reset font size").focus();
    await page.keyboard.press("Enter");
    await expect(field).toBeFocused();
    expect(await computed(page, "heading-1", "font-size")).toBe("30px");
    // Tab order continues from the field, both ways, without leaving the Inspector.
    const inInspector = () =>
      page.evaluate(
        () =>
          document.activeElement?.closest(
            "aside[aria-label='Inspector panel']",
          ) !== null,
      );
    await page.keyboard.press("Shift+Tab");
    expect(await inInspector()).toBe(true);
    await page.keyboard.press("Tab");
    expect(await inInspector()).toBe(true);

    // Space on a segmented property's reset → focus lands on its selected option.
    await openSection(page, "Typography");
    await row(page, "Align").getByRole("button", { name: "Center" }).click();
    await resetButton(page, "Reset text alignment").focus();
    await page.keyboard.press(" ");
    await expect(resetButton(page, "Reset text alignment")).toBeDisabled();
    expect(await focusedLabel(page)).not.toBe("BODY");
    expect(
      await page.evaluate(
        () =>
          document.activeElement
            ?.closest("[data-inspector-reset-scope]")
            ?.textContent?.includes("Align") ?? false,
      ),
    ).toBe(true);

    // Repeated reset: nothing left, the button is hidden and inert.
    await expect(resetButton(page, "Reset font size")).toBeDisabled();
  });

  test("Transform, Background and Border resets keep their siblings", async ({
    page,
  }) => {
    await start(page);
    const original = await exportedCode(page);
    await selectOnCanvas(page, "heading-1");
    await openSection(page, "Transform");
    await setField(page, "Rotate", "20");
    await setField(page, "Scale", "1.5");
    const scaleOnly = await page.evaluate(() => {
      const probe = document.createElement("div");
      probe.style.transform = "scale(1.5)";
      document.body.append(probe);
      const value = getComputedStyle(probe).transform;
      probe.remove();
      return value;
    });
    await resetButton(page, "Reset rotate").click();
    expect(
      await computed(page, "heading-1", "transform"),
      "only the rotation was removed",
    ).toBe(scaleOnly);
    await expect(
      inspector(page).getByLabel("Scale", { exact: true }),
    ).toHaveValue("1.5");
    await undo(page);
    expect(await computed(page, "heading-1", "transform")).not.toBe(scaleOnly);
    await redo(page);
    await resetButton(page, "Reset scale").click();
    expect(await computed(page, "heading-1", "transform")).toBe("none");

    await openSection(page, "Background");
    await setField(page, "Background color", "#ffcc00");
    expect(await computed(page, "heading-1", "background-color")).toBe(
      "rgb(255, 204, 0)",
    );
    await resetButton(page, "Reset background color").click();
    expect(await computed(page, "heading-1", "background-color")).toBe(
      "rgba(0, 0, 0, 0)",
    );

    await selectOnCanvas(page, "section-1");
    await openSection(page, "Border");
    const defaultBorder = await computed(page, "section-1", "border-top-color");
    await setField(page, "Border width", "4");
    await resetButton(page, "Reset border width").click();
    expect(await computed(page, "section-1", "border-top-width")).toBe("1px");
    expect(
      await computed(page, "section-1", "border-top-color"),
      "the default border returns",
    ).toBe(defaultBorder);

    expect(
      await exportedCode(page),
      "every reset leaves the export as it was",
    ).toBe(original);
  });
});

function layoutDocument(): EditorElementNode {
  return {
    id: "page-root",
    tag: "page",
    children: [
      {
        id: "row",
        tag: "div",
        spacing: {
          margin: { top: 0, right: 0, bottom: 0, left: 0 },
          padding: { top: 24, right: 24, bottom: 24, left: 24 },
        },
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
          {
            id: "item",
            tag: "p",
            text: "Flex item",
            flexChild: { grow: 1, shrink: 0, basis: "auto", alignSelf: "end" },
          },
          { id: "other", tag: "p", text: "Other item" },
        ],
      },
      {
        id: "grid",
        tag: "div",
        spacing: {
          margin: { top: 0, right: 0, bottom: 0, left: 0 },
          padding: { top: 24, right: 24, bottom: 24, left: 24 },
        },
        flowLayout: {
          display: "grid",
          grid: { columns: 4, rows: "auto", rowGap: 16, columnGap: 16 },
        },
        children: [
          {
            id: "cell",
            tag: "p",
            text: "Cell",
            gridChild: {
              columnStart: 2,
              columnSpan: 2,
              rowStart: "auto",
              rowSpan: 1,
            },
          },
          { id: "cell-2", tag: "p", text: "Cell 2" },
        ],
      },
    ],
  };
}

test.describe("BC-05.2 Layout, Flex item and Grid item resets", () => {
  test("container, flex item and grid item settings reset on their own; Preview and Export agree", async ({
    page,
  }) => {
    await start(page);
    await importDocument(page, layoutDocument(), "cell-2");
    const keywordDeclarations = (code: string) =>
      code.match(/:\s*(initial|unset|revert|inherit)\s*;/g)?.length ?? 0;
    const keywordsBefore = keywordDeclarations(await exportedCode(page));

    await selectOnCanvas(page, "row");
    await openSection(page, "Content Layout");
    await resetButton(page, "Reset direction").click();
    expect(await computed(page, "row", "flex-direction")).toBe("row");
    expect(await computed(page, "row", "flex-wrap"), "wrap untouched").toBe(
      "wrap",
    );
    await resetButton(page, "Reset gap").click();
    expect(await computed(page, "row", "column-gap")).toBe("0px");
    await undo(page);
    expect(await computed(page, "row", "column-gap")).toBe("20px");
    await expect(resetButton(page, "Reset direction")).toBeDisabled();
    await expect(resetButton(page, "Reset justify content")).toBeEnabled();
    // Display and Layout mode are structural: no reset.
    await expect(
      row(page, "Display").locator("[data-inspector-reset]"),
    ).toHaveCount(0);

    await selectOnCanvas(page, "item");
    await openSection(page, "Flex item");
    await resetButton(page, "Reset grow").click();
    expect(await computed(page, "item", "flex-grow")).toBe("0");
    expect(
      await computed(page, "item", "align-self"),
      "align self untouched",
    ).toBe("flex-end");
    await resetButton(page, "Reset flex item").click();
    expect(await computed(page, "item", "align-self")).toBe("auto");
    expect(await computed(page, "item", "flex-shrink")).toBe("1");

    await selectOnCanvas(page, "grid");
    await openSection(page, "Content Layout");
    await resetButton(page, "Reset columns").click();
    // The authored template (the computed one also counts the implicit track the spanning cell needs).
    expect(
      await canvasNode(page, "grid").evaluate(
        (element) => (element as HTMLElement).style.gridTemplateColumns,
      ),
    ).toMatch(/^repeat\(2, minmax\(0(px)?, 1fr\)\)$/);

    await selectOnCanvas(page, "cell");
    await openSection(page, "Grid item");
    await resetButton(page, "Reset column start").click();
    expect(await computed(page, "cell", "grid-column-start")).toBe("span 2");

    // Preview renders the same.
    const design = [
      await computed(page, "row", "flex-direction"),
      await computed(page, "item", "align-self"),
      await computed(page, "grid", "grid-template-columns"),
    ];
    await page.getByRole("button", { name: "Enter Preview" }).click();
    expect([
      await computed(page, "row", "flex-direction"),
      await computed(page, "item", "align-self"),
      await computed(page, "grid", "grid-template-columns"),
    ]).toEqual(design);
    await page.getByRole("button", { name: "Exit Preview" }).click();

    // Export: the reset values are the defaults, with no keyword fallbacks.
    const code = await exportedCode(page);
    // The base reset stylesheet has its own inherit declarations; resets add none.
    expect(keywordDeclarations(code)).toBe(keywordsBefore);
    expect(code).toContain("flex-direction: row");
    expect(code).toContain("repeat(2, minmax(0, 1fr))");
    expect(code).not.toContain("align-self: flex-end");
  });

  test("selection changes and the narrowest Inspector width", async ({
    page,
  }) => {
    await start(page);
    await importDocument(page, layoutDocument(), "cell-2");
    await selectOnCanvas(page, "item");
    await openSection(page, "Flex item");
    await expect(resetButton(page, "Reset grow")).toBeEnabled();
    await selectOnCanvas(page, "other");
    await expect(
      resetButton(page, "Reset grow"),
      "another element: nothing authored",
    ).toBeDisabled();
    await expect(resetButton(page, "Reset flex item")).toBeDisabled();
    await selectOnCanvas(page, "item");
    await expect(resetButton(page, "Reset grow")).toBeEnabled();

    const handle = page.getByRole("separator", {
      name: "Resize Inspector Panel",
    });
    const box = await handle.boundingBox();
    if (!box) throw new Error("no handle");
    await page.mouse.move(box.x + box.width / 2, box.y + 300);
    await page.mouse.down();
    await page.mouse.move(1599, box.y + 300, { steps: 10 });
    await page.mouse.up();
    await expect(handle).toHaveAttribute(
      "aria-valuenow",
      (await handle.getAttribute("aria-valuemin")) ?? "",
    );

    for (const target of ["item", "row", "cell"]) {
      await selectOnCanvas(page, target);
      const overflow = await inspector(page).evaluate((panel) => {
        const bounds = panel.getBoundingClientRect();
        return Array.from(
          panel.querySelectorAll<HTMLElement>(
            "[data-inspector-reset]:not(:disabled), [data-inspector-reset-scope] input, [data-inspector-reset-scope] button",
          ),
        )
          .filter((element) => element.getClientRects().length > 0)
          .filter((element) => {
            const rect = element.getBoundingClientRect();
            return (
              rect.right > bounds.right + 0.5 || rect.left < bounds.left - 0.5
            );
          })
          .map(
            (element) =>
              element.getAttribute("aria-label") ??
              element.textContent ??
              element.tagName,
          );
      });
      expect(
        overflow,
        `${target}: every control and reset stays inside the Inspector`,
      ).toEqual([]);
    }
  });
});
