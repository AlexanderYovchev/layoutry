import { expect, test, type Page } from "@playwright/test";
import { gotoApp } from "./support/gotoApp";

/**
 * BC-01.2 — Inspector color text fields and the slider exact-value field
 * in a real browser. The original bugs only appeared with real focus:
 * Enter/Escape call .blur(), and only a genuinely focused input dispatches
 * the blur event that committed a second time (Enter) or committed the
 * discarded draft (Escape). jsdom tests can't fully stand in for that
 * event order, so it is checked here end to end, including Undo/Redo.
 *
 * Every test starts from a fresh page, whose undo history is empty, so
 * "one Undo restores it AND Undo is then disabled" proves the edit made
 * exactly one history entry.
 */

const canvasNode = (page: Page, id: string) =>
  page.locator(`[data-node-id="${id}"]`).first();

const computed = (page: Page, id: string, property: string) =>
  canvasNode(page, id).evaluate(
    (element, prop) => getComputedStyle(element).getPropertyValue(prop),
    property,
  );

async function selectOnCanvas(page: Page, id: string) {
  await canvasNode(page, id).click({ position: { x: 5, y: 5 } });
}

/** Clicks blank Inspector chrome: moves focus off the field like a user clicking elsewhere, without changing the selection. */
async function clickInspectorChrome(page: Page) {
  await page
    .locator("[data-inspector-palette]")
    .first()
    .click({ position: { x: 5, y: 5 } });
}

async function expectUndoAvailable(page: Page, available: boolean) {
  await page.getByRole("menuitem", { name: "Edit" }).click();
  const undo = page.getByRole("menuitem", { name: "Undo" });
  if (available) await expect(undo).toBeEnabled();
  else await expect(undo).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu")).toBeHidden();
}

async function replaceText(page: Page, label: string, text: string) {
  const field = page.getByLabel(label, { exact: true });
  await field.click();
  await field.press("Control+a");
  await page.keyboard.type(text);
  return field;
}

test.describe("Inspector color text field (BC-01.2)", () => {
  test.beforeEach(async ({ page }) => {
    await gotoApp(page);
    await selectOnCanvas(page, "heading-1");
    await expect(page.getByLabel("Text color", { exact: true })).toBeVisible();
  });

  test("Escape discards a typed color: Canvas unchanged, field reverts, no history", async ({
    page,
  }) => {
    const original = await computed(page, "heading-1", "color");
    const field = await replaceText(page, "Text color", "#00ff00");
    await field.press("Escape");

    await expect(field).not.toBeFocused();
    await expect(field).toHaveValue("");
    expect(await computed(page, "heading-1", "color")).toBe(original);
    await expectUndoAvailable(page, false);
  });

  test("Enter commits once: one Undo restores, one Redo reapplies", async ({
    page,
  }) => {
    const original = await computed(page, "heading-1", "color");
    const field = await replaceText(page, "Text color", "#ff0000");
    await field.press("Enter");
    await expect
      .poll(() => computed(page, "heading-1", "color"))
      .toBe("rgb(255, 0, 0)");

    await page.keyboard.press("Control+z");
    await expect
      .poll(() => computed(page, "heading-1", "color"))
      .toBe(original);
    await expect(field).toHaveValue("");
    await expectUndoAvailable(page, false);

    await page.keyboard.press("Control+Shift+z");
    await expect
      .poll(() => computed(page, "heading-1", "color"))
      .toBe("rgb(255, 0, 0)");
    await expect(field).toHaveValue("#ff0000");
  });

  test("blur after editing commits exactly once", async ({ page }) => {
    const original = await computed(page, "heading-1", "color");
    await replaceText(page, "Text color", "rgb(0, 0, 255)");
    await clickInspectorChrome(page);
    await expect
      .poll(() => computed(page, "heading-1", "color"))
      .toBe("rgb(0, 0, 255)");

    await page.keyboard.press("Control+z");
    await expect
      .poll(() => computed(page, "heading-1", "color"))
      .toBe(original);
    await expectUndoAvailable(page, false);
  });

  test("focus and blur of an unchanged color creates no history (unset and set)", async ({
    page,
  }) => {
    const field = page.getByLabel("Text color", { exact: true });

    // Unset: stays unset.
    await field.click();
    await clickInspectorChrome(page);
    await field.click();
    await field.press("Enter");
    await expect(field).toHaveValue("");
    await expectUndoAvailable(page, false);

    // Set: one real edit, then focus-through and Enter with no edit.
    const original = await computed(page, "heading-1", "color");
    await replaceText(page, "Text color", "#ff0000");
    await field.press("Enter");
    await field.click();
    await clickInspectorChrome(page);
    await field.click();
    await field.press("Enter");

    await page.keyboard.press("Control+z");
    await expect
      .poll(() => computed(page, "heading-1", "color"))
      .toBe(original);
    await expectUndoAvailable(page, false);
  });

  test("an invalid color shows an error and leaves the document and history untouched", async ({
    page,
  }) => {
    const original = await computed(page, "heading-1", "color");
    const field = await replaceText(page, "Text color", "#12");
    await field.press("Enter");

    await expect(
      page.getByText("Enter a hex color (#RRGGBB) or an rgb()/rgba() value."),
    ).toBeVisible();
    expect(await computed(page, "heading-1", "color")).toBe(original);
    await expectUndoAvailable(page, false);
  });

  test("the native color picker still commits once", async ({ page }) => {
    const original = await computed(page, "heading-1", "color");
    // fill() on a type=color input dispatches input + change, the same
    // events the browser sends when the user confirms a pick.
    await page.getByLabel("Choose text color", { exact: true }).fill("#00aa00");
    await expect
      .poll(() => computed(page, "heading-1", "color"))
      .toBe("rgb(0, 170, 0)");
    await expect(page.getByLabel("Text color", { exact: true })).toHaveValue(
      "#00aa00",
    );

    // Ctrl+Z is deliberately ignored while focus is in an input.
    await clickInspectorChrome(page);
    await page.keyboard.press("Control+z");
    await expect
      .poll(() => computed(page, "heading-1", "color"))
      .toBe(original);
    await expectUndoAvailable(page, false);
  });

  test("switching selection with a pending edit applies it to the original element only", async ({
    page,
  }) => {
    const paragraphBefore = await computed(page, "paragraph-1", "color");
    // Open the tree first, so the click that blurs the field is the same
    // click that changes the selection.
    await page.getByRole("tab", { name: "Structure" }).click();
    await replaceText(page, "Text color", "#ff0000");
    await page
      .getByRole("treeitem", { name: /Paragraph/ })
      .first()
      .click();
    await expect(
      page.getByText("Paragraph", { exact: true }).first(),
    ).toBeVisible();
    await expect(page.getByLabel("Text color", { exact: true })).toHaveValue(
      "",
    );

    expect(await computed(page, "heading-1", "color")).toBe("rgb(255, 0, 0)");
    expect(await computed(page, "paragraph-1", "color")).toBe(paragraphBefore);
  });
});

test.describe("Inspector slider exact-value field (BC-01.2)", () => {
  test.beforeEach(async ({ page }) => {
    await gotoApp(page);
    await selectOnCanvas(page, "image-1");
    await expect(
      page.getByLabel("Opacity (exact value)", { exact: true }),
    ).toBeVisible();
  });

  test("Escape discards a typed value: Canvas unchanged, field reverts, no history", async ({
    page,
  }) => {
    const field = await replaceText(page, "Opacity (exact value)", "25");
    await field.press("Escape");

    await expect(field).not.toBeFocused();
    await expect(field).toHaveValue("100");
    expect(await computed(page, "image-1", "opacity")).toBe("1");
    await expectUndoAvailable(page, false);
  });

  test("Enter commits once: one Undo restores, one Redo reapplies", async ({
    page,
  }) => {
    const field = await replaceText(page, "Opacity (exact value)", "40");
    await field.press("Enter");
    await expect.poll(() => computed(page, "image-1", "opacity")).toBe("0.4");

    await page.keyboard.press("Control+z");
    await expect.poll(() => computed(page, "image-1", "opacity")).toBe("1");
    await expect(field).toHaveValue("100");
    await expectUndoAvailable(page, false);

    await page.keyboard.press("Control+Shift+z");
    await expect.poll(() => computed(page, "image-1", "opacity")).toBe("0.4");
    await expect(field).toHaveValue("40");
  });

  test("blur commits once; focus-through and an emptied draft create no history", async ({
    page,
  }) => {
    const field = page.getByLabel("Opacity (exact value)", { exact: true });

    await field.click();
    await clickInspectorChrome(page);
    await replaceText(page, "Opacity (exact value)", "");
    await field.press("Enter");
    await expect(field).toHaveValue("100");
    await expectUndoAvailable(page, false);

    await replaceText(page, "Opacity (exact value)", "60");
    await clickInspectorChrome(page);
    await expect.poll(() => computed(page, "image-1", "opacity")).toBe("0.6");
    await page.keyboard.press("Control+z");
    await expect.poll(() => computed(page, "image-1", "opacity")).toBe("1");
    await expectUndoAvailable(page, false);
  });

  test("the range slider still updates live and records one entry per adjustment", async ({
    page,
  }) => {
    const slider = page.getByRole("slider", { name: "Opacity" });
    await slider.focus();
    await slider.press("ArrowLeft");
    await expect.poll(() => computed(page, "image-1", "opacity")).toBe("0.99");
    await expect(
      page.getByLabel("Opacity (exact value)", { exact: true }),
    ).toHaveValue("99");

    // Ctrl+Z is deliberately ignored while focus is in an input.
    await clickInspectorChrome(page);
    await page.keyboard.press("Control+z");
    await expect.poll(() => computed(page, "image-1", "opacity")).toBe("1");
    await expectUndoAvailable(page, false);
  });
});
