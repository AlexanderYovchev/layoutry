import { expect, test, type Page } from "@playwright/test";
import { gotoApp } from "./support/gotoApp";
import {
  clickInspectorChrome,
  computed,
  expectUndoAvailable,
  replaceText,
  selectOnCanvas,
} from "./support/inspector";

/**
 * BC-01.5 — unset Line height and Letter spacing show what the Canvas
 * renders (not 1.5 / 0), `normal` stays "Normal", and stepping/editing
 * stays live with one undo entry. Values are checked against the real
 * computed styles of the Canvas element. Fresh page per test (empty
 * history): "one Undo restores AND Undo is then disabled" = one entry.
 */

const field = (page: Page, label: string) =>
  page.getByLabel(label, { exact: true });

async function undo(page: Page) {
  // Ctrl+Z is deliberately ignored while focus is inside an input.
  await page.evaluate(() =>
    (document.activeElement as HTMLElement | null)?.blur(),
  );
  await page.keyboard.press("Control+z");
}

/** What the Inspector should show for an unset value, derived from the Canvas element's computed style. */
async function expectedUnsetDisplay(page: Page, id: string) {
  const [fontSize, lineHeight, letterSpacing] = await Promise.all([
    computed(page, id, "font-size"),
    computed(page, id, "line-height"),
    computed(page, id, "letter-spacing"),
  ]);
  const ratio = (px: string) =>
    String(Math.round((parseFloat(px) / parseFloat(fontSize)) * 1000) / 1000);
  return {
    lineHeight: lineHeight === "normal" ? "" : ratio(lineHeight),
    letterSpacing:
      letterSpacing === "normal"
        ? ""
        : String(Math.round(parseFloat(letterSpacing) * 1000) / 1000),
    lineHeightIsNormal: lineHeight === "normal",
    letterSpacingIsNormal: letterSpacing === "normal",
  };
}

async function expectInspectorMatchesCanvas(page: Page, id: string) {
  const expected = await expectedUnsetDisplay(page, id);
  await expect(field(page, "Line height")).toHaveValue(expected.lineHeight);
  await expect(field(page, "Letter spacing")).toHaveValue(
    expected.letterSpacing,
  );
  if (expected.lineHeightIsNormal)
    await expect(field(page, "Line height")).toHaveAttribute(
      "placeholder",
      "Normal",
    );
  if (expected.letterSpacingIsNormal)
    await expect(field(page, "Letter spacing")).toHaveAttribute(
      "placeholder",
      "Normal",
    );
  return expected;
}

async function insertSelectField(page: Page) {
  await page.getByRole("button", { name: "Components" }).click();
  await page.getByRole("menuitem", { name: /^Labeled Select Field/ }).click();
  const id = (type: string) =>
    page
      .locator(`[data-document-surface] [data-node-type="${type}"]`)
      .first()
      .getAttribute("data-node-id");
  const [selectId, optionId] = await Promise.all([id("select"), id("option")]);
  if (!selectId || !optionId) throw new Error("select field not inserted");
  await page.getByRole("tab", { name: "Structure" }).click();
  const tree = page.getByRole("tree", { name: "Page structure" });
  await tree.getByRole("button", { name: "Expand Select" }).click();
  return {
    selectId,
    optionId,
    selectSelect: () =>
      tree
        .getByRole("treeitem", { name: /Select/ })
        .first()
        .click(),
    selectOption: () =>
      tree
        .getByRole("treeitem", { name: /Option/ })
        .first()
        .click(),
  };
}

test.describe("unset values match the Canvas", () => {
  test("Heading, Paragraph and Button show their rendered line height and letter spacing", async ({
    page,
  }) => {
    await gotoApp(page);
    for (const id of ["heading-1", "paragraph-1", "button-1"]) {
      await selectOnCanvas(page, id);
      await expectInspectorMatchesCanvas(page, id);
    }
    // The concrete defaults, for the record (no 1.5 / 0 guesses).
    await selectOnCanvas(page, "heading-1");
    await expect(field(page, "Line height")).toHaveValue("1.2");
    await expect(field(page, "Letter spacing")).toHaveValue("-0.75");
    await selectOnCanvas(page, "paragraph-1");
    await expect(field(page, "Line height")).toHaveValue("1.625");
    await expect(field(page, "Letter spacing")).toHaveAttribute(
      "placeholder",
      "Normal",
    );
    await expectUndoAvailable(page, false);
  });

  test("a select's computed `normal` line height shows as Normal; its option inherits the select's letter spacing and follows it", async ({
    page,
  }) => {
    await gotoApp(page);
    const select = await insertSelectField(page);
    await select.selectSelect();
    expect(await computed(page, select.selectId, "line-height")).toBe("normal");
    await expectInspectorMatchesCanvas(page, select.selectId);

    await select.selectOption();
    await expectInspectorMatchesCanvas(page, select.optionId);

    // Parent -> child: the option has no letter-spacing of its own.
    await select.selectSelect();
    const spacing = await replaceText(page, "Letter spacing", "2");
    await spacing.press("Enter");
    await select.selectOption();
    expect(await computed(page, select.optionId, "letter-spacing")).toBe("2px");
    await expect(field(page, "Letter spacing")).toHaveValue("2");
    await expectInspectorMatchesCanvas(page, select.optionId);
  });

  test("from `normal`, Arrow Up writes the documented 1.2 baseline step (1.3) only once the user steps; Escape removes it", async ({
    page,
  }) => {
    await gotoApp(page);
    const select = await insertSelectField(page);
    const inlineLineHeight = () =>
      page
        .locator(`[data-node-id="${select.selectId}"]`)
        .first()
        .evaluate((element) => (element as HTMLElement).style.lineHeight);
    await select.selectSelect();
    await field(page, "Line height").click();
    await clickInspectorChrome(page);
    expect(await inlineLineHeight()).toBe("");

    await field(page, "Line height").click();
    await field(page, "Line height").press("ArrowUp");
    // The document now holds 1.3 (the Canvas writes it inline). Chromium
    // itself keeps rendering a <select> at line-height: normal whatever is
    // authored — a browser rule, reproduced on a plain HTML page too.
    await expect.poll(inlineLineHeight).toBe("1.3");
    expect(await computed(page, select.selectId, "line-height")).toBe("normal");
    await field(page, "Line height").press("Escape");
    await expect.poll(inlineLineHeight).toBe("");
    await expect(field(page, "Line height")).toHaveAttribute(
      "placeholder",
      "Normal",
    );
    // Only the insertion is in history: one Undo removes the whole field.
    await undo(page);
    await expect(
      page.locator(`[data-node-id="${select.selectId}"]`),
    ).toHaveCount(0);
    await expectUndoAvailable(page, false);
  });
});

test.describe("editing from the effective value", () => {
  test.beforeEach(async ({ page }) => {
    await gotoApp(page);
    await selectOnCanvas(page, "heading-1");
  });

  test("line height: Arrow Up from 1.2 -> 1.3 live; one Undo back to the default; Redo", async ({
    page,
  }) => {
    const input = field(page, "Line height");
    await input.click();
    await input.press("ArrowUp");
    await expect
      .poll(() => computed(page, "heading-1", "line-height"))
      .toBe("39px");
    await expect(input).toHaveValue("1.3");
    await expect(input).toBeFocused();
    await input.press("Enter");

    await undo(page);
    await expect
      .poll(() => computed(page, "heading-1", "line-height"))
      .toBe("36px");
    await expect(input).toHaveValue("1.2");
    await expectUndoAvailable(page, false);
    await page.keyboard.press("Control+Shift+z");
    await expect
      .poll(() => computed(page, "heading-1", "line-height"))
      .toBe("39px");
  });

  test("line height: typed value is live before blur; Escape restores the unset default", async ({
    page,
  }) => {
    const input = await replaceText(page, "Line height", "2");
    await expect
      .poll(() => computed(page, "heading-1", "line-height"))
      .toBe("60px");
    await expect(input).toBeFocused();
    await input.press("Escape");
    await expect
      .poll(() => computed(page, "heading-1", "line-height"))
      .toBe("36px");
    await expect(input).toHaveValue("1.2");
    await expectUndoAvailable(page, false);
  });

  test("letter spacing: Arrow Up from -0.75px -> 0.25px live; Escape restores the default", async ({
    page,
  }) => {
    const input = field(page, "Letter spacing");
    await input.click();
    await input.press("ArrowUp");
    await expect
      .poll(() => computed(page, "heading-1", "letter-spacing"))
      .toBe("0.25px");
    await input.press("Escape");
    await expect
      .poll(() => computed(page, "heading-1", "letter-spacing"))
      .toBe("-0.75px");
    await expect(input).toHaveValue("-0.75");
    await expectUndoAvailable(page, false);
  });

  test("letter spacing `normal` (paragraph): Arrow Up starts at 0 -> 1px; one Undo back to normal", async ({
    page,
  }) => {
    await selectOnCanvas(page, "paragraph-1");
    const input = field(page, "Letter spacing");
    await input.click();
    await input.press("ArrowUp");
    await expect
      .poll(() => computed(page, "paragraph-1", "letter-spacing"))
      .toBe("1px");
    await clickInspectorChrome(page);
    await undo(page);
    await expect
      .poll(() => computed(page, "paragraph-1", "letter-spacing"))
      .toBe("normal");
    await expect(input).toHaveAttribute("placeholder", "Normal");
    await expectUndoAvailable(page, false);
  });

  test("focusing and leaving the unset fields authors nothing; Preview and Export reflect only real edits", async ({
    page,
  }) => {
    for (const label of ["Line height", "Letter spacing"]) {
      await field(page, label).click();
      await clickInspectorChrome(page);
    }
    await expectUndoAvailable(page, false);

    const exportCode = page
      .getByRole("dialog", { name: "Export Code" })
      .getByTestId("export-code");
    await page.getByRole("button", { name: "Export Code" }).click();
    await expect(exportCode).not.toContainText("line-height: 1.2;");
    await expect(exportCode).not.toContainText("letter-spacing: -0.75px");
    await page.keyboard.press("Escape");

    await field(page, "Line height").click();
    await field(page, "Line height").press("ArrowUp");
    await field(page, "Line height").press("Enter");
    await page.getByRole("button", { name: "Enter Preview" }).click();
    await expect
      .poll(() => computed(page, "heading-1", "line-height"))
      .toBe("39px");
    expect(await computed(page, "heading-1", "letter-spacing")).toBe("-0.75px");
    await page.getByRole("button", { name: "Exit Preview" }).click();
    await page.getByRole("button", { name: "Export Code" }).click();
    await expect(exportCode).toContainText(/line-height:\s*1\.3/);
  });
});
