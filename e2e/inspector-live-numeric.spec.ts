import { expect, test, type Page } from "@playwright/test";
import { gotoApp } from "./support/gotoApp";
import {
  canvasNode,
  clickInspectorChrome,
  computed,
  expectUndoAvailable,
  replaceText,
  selectOnCanvas,
} from "./support/inspector";

/**
 * BC-01.3 — live numeric Inspector editing in a real browser: valid values
 * reach the Canvas while typing (before Enter/blur), the field keeps focus
 * and caret, and one edit is one undo entry. Real typing matters here:
 * Chromium reports "" for partial number input like "-" or "1.", and
 * focus/blur/pointerdown ordering decides which element an edit lands on.
 *
 * Fresh page per test (empty history): "one Undo restores AND Undo is
 * then disabled" proves the edit made exactly one entry.
 */

const fontSizeField = (page: Page) =>
  page.getByLabel("Font size", { exact: true });

async function undo(page: Page) {
  // Ctrl+Z is deliberately ignored while focus is inside an input.
  await page.evaluate(() =>
    (document.activeElement as HTMLElement | null)?.blur(),
  );
  await page.keyboard.press("Control+z");
}

test.describe("live updates across elements (Spacing: padding)", () => {
  for (const id of [
    "heading-1",
    "paragraph-1",
    "image-1",
    "section-1",
    "button-1",
  ]) {
    test(`${id}: padding reaches the Canvas before blur, one entry`, async ({
      page,
    }) => {
      await gotoApp(page);
      await selectOnCanvas(page, id);
      const original = await computed(page, id, "padding-top");
      const field = await replaceText(page, "Padding (all sides)", "33");

      await expect.poll(() => computed(page, id, "padding-top")).toBe("33px");
      await expect(field).toBeFocused();

      await field.press("Enter");
      await undo(page);
      await expect.poll(() => computed(page, id, "padding-top")).toBe(original);
      await expectUndoAvailable(page, false);
    });
  }

  test("navbar: per-side padding Top is live too", async ({ page }) => {
    await gotoApp(page);
    await page.getByRole("button", { name: "Components" }).click();
    await page.getByRole("menuitem", { name: /^Basic Navbar/ }).click();
    const nav = page.locator('[data-node-type="nav"]').first();
    const id = await nav.getAttribute("data-node-id");
    if (!id) throw new Error("navbar was not inserted");
    await selectOnCanvas(page, id);

    const field = page.getByLabel("Top", { exact: true }).first();
    await field.click();
    await field.press("Control+a");
    await page.keyboard.type("41");
    await expect.poll(() => computed(page, id, "padding-top")).toBe("41px");
    await expect(field).toBeFocused();
  });
});

test.describe("Typography font size", () => {
  test.beforeEach(async ({ page }) => {
    await gotoApp(page);
    await selectOnCanvas(page, "heading-1");
  });

  test("several keystrokes are one entry: one Undo restores the unset size, one Redo the final value", async ({
    page,
  }) => {
    const original = await computed(page, "heading-1", "font-size");
    const field = fontSizeField(page);
    await field.click();
    await field.press("Control+a");
    await page.keyboard.type("2");
    await expect
      .poll(() => computed(page, "heading-1", "font-size"))
      .toBe("2px");
    await page.keyboard.type("4");
    await expect
      .poll(() => computed(page, "heading-1", "font-size"))
      .toBe("24px");
    await field.press("Control+a");
    await page.keyboard.type("32");
    await expect
      .poll(() => computed(page, "heading-1", "font-size"))
      .toBe("32px");
    await field.press("Enter");

    await undo(page);
    await expect
      .poll(() => computed(page, "heading-1", "font-size"))
      .toBe(original);
    await expect(field).toHaveValue("30");
    await expectUndoAvailable(page, false);

    await page.keyboard.press("Control+Shift+z");
    await expect
      .poll(() => computed(page, "heading-1", "font-size"))
      .toBe("32px");
    await expect(field).toHaveValue("32");
  });

  test("the caret stays where the user put it across live writes", async ({
    page,
  }) => {
    const field = await replaceText(page, "Font size", "32");
    await expect
      .poll(() => computed(page, "heading-1", "font-size"))
      .toBe("32px");
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.type("1");
    await expect(field).toHaveValue("312");
    await page.keyboard.type("5");
    await expect(field).toHaveValue("3152");
    await expect
      .poll(() => computed(page, "heading-1", "font-size"))
      .toBe("3152px");
  });

  test("Escape restores the unset size, the field's value and leaves no history", async ({
    page,
  }) => {
    const original = await computed(page, "heading-1", "font-size");
    const field = await replaceText(page, "Font size", "48");
    await expect
      .poll(() => computed(page, "heading-1", "font-size"))
      .toBe("48px");
    await field.press("Escape");

    await expect(field).not.toBeFocused();
    await expect(field).toHaveValue("30");
    expect(await computed(page, "heading-1", "font-size")).toBe(original);
    await expectUndoAvailable(page, false);
  });

  test('partial and invalid input ("-", "-5") is never written; Enter on an invalid draft reverts', async ({
    page,
  }) => {
    const original = await computed(page, "heading-1", "font-size");
    const field = await replaceText(page, "Font size", "-");
    expect(await computed(page, "heading-1", "font-size")).toBe(original);
    await page.keyboard.type("5");
    await expect(
      page.getByText("Enter a font size greater than 0."),
    ).toBeVisible();
    expect(await computed(page, "heading-1", "font-size")).toBe(original);

    await field.press("Enter");
    await expect(field).toHaveValue("30");
    expect(await computed(page, "heading-1", "font-size")).toBe(original);
    await expectUndoAvailable(page, false);
  });

  test("an incomplete final draft reverts a live edit on blur instead of keeping the intermediate preview", async ({
    page,
  }) => {
    const original = await computed(page, "heading-1", "font-size");
    const field = await replaceText(page, "Font size", "24");
    await expect
      .poll(() => computed(page, "heading-1", "font-size"))
      .toBe("24px");
    await field.press("Control+a");
    await page.keyboard.type("-");
    await clickInspectorChrome(page);

    await expect(field).toHaveValue("30");
    await expect
      .poll(() => computed(page, "heading-1", "font-size"))
      .toBe(original);
    await expectUndoAvailable(page, false);
  });

  test("rapid typing loses no update and is one entry", async ({ page }) => {
    const original = await computed(page, "heading-1", "font-size");
    const field = fontSizeField(page);
    await field.click();
    await field.press("Control+a");
    await page.keyboard.type("9876", { delay: 0 });
    await expect
      .poll(() => computed(page, "heading-1", "font-size"))
      .toBe("9876px");
    await clickInspectorChrome(page);

    await undo(page);
    await expect
      .poll(() => computed(page, "heading-1", "font-size"))
      .toBe(original);
    await expectUndoAvailable(page, false);
  });
});

test.describe("other sections share the live control", () => {
  test("line height: the partial '1.' keeps the '1' preview and the typed text; '1.8' goes live", async ({
    page,
  }) => {
    await gotoApp(page);
    await selectOnCanvas(page, "heading-1");
    // "1" is itself valid (30px at the 30px font size); the trailing "."
    // is a partial number Chromium reports as "", so nothing new is written.
    const field = await replaceText(page, "Line height", "1.");
    await expect
      .poll(() => computed(page, "heading-1", "line-height"))
      .toBe("30px");
    await expect(field).toBeFocused();
    await page.keyboard.type("8");
    await expect
      .poll(() => computed(page, "heading-1", "line-height"))
      .toBe("54px");
  });

  test("button: Width, Border radius and Rotate update before blur", async ({
    page,
  }) => {
    await gotoApp(page);
    await selectOnCanvas(page, "button-1");

    await replaceText(page, "Width", "260");
    await expect.poll(() => computed(page, "button-1", "width")).toBe("260px");

    await replaceText(page, "Border radius", "14");
    await expect
      .poll(() => computed(page, "button-1", "border-top-left-radius"))
      .toBe("14px");

    await replaceText(page, "Rotate", "90");
    await expect
      .poll(() => computed(page, "button-1", "transform"))
      .toMatch(/^matrix\((6\.1\d*e-17|0), 1, -1, (6\.1\d*e-17|0)/);
  });

  test("Width: a cleared draft is not previewed; it commits 'auto' on blur as before", async ({
    page,
  }) => {
    await gotoApp(page);
    await selectOnCanvas(page, "button-1");
    const original = await computed(page, "button-1", "width");
    const field = await replaceText(page, "Width", "300");
    await expect.poll(() => computed(page, "button-1", "width")).toBe("300px");
    await field.press("Control+a");
    await field.press("Backspace");
    expect(await computed(page, "button-1", "width")).toBe("300px");

    await clickInspectorChrome(page);
    await expect.poll(() => computed(page, "button-1", "width")).toBe(original);
  });
});

test.describe("selection changes during an edit", () => {
  test.beforeEach(async ({ page }) => {
    await gotoApp(page);
    await selectOnCanvas(page, "heading-1");
  });

  test("clicking another element on the Canvas commits to the original element only", async ({
    page,
  }) => {
    const paragraphBefore = await computed(page, "paragraph-1", "font-size");
    await replaceText(page, "Font size", "40");
    await selectOnCanvas(page, "paragraph-1");

    await expect(fontSizeField(page)).toHaveValue("16");
    expect(await computed(page, "heading-1", "font-size")).toBe("40px");
    expect(await computed(page, "paragraph-1", "font-size")).toBe(
      paragraphBefore,
    );
  });

  test("clicking another element in the Structure tree commits to the original element only", async ({
    page,
  }) => {
    const paragraphBefore = await computed(page, "paragraph-1", "font-size");
    await page.getByRole("tab", { name: "Structure" }).click();
    await replaceText(page, "Font size", "40");
    await page
      .getByRole("treeitem", { name: /Paragraph/ })
      .first()
      .click();

    await expect(fontSizeField(page)).toHaveValue("16");
    expect(await computed(page, "heading-1", "font-size")).toBe("40px");
    expect(await computed(page, "paragraph-1", "font-size")).toBe(
      paragraphBefore,
    );
    await undo(page);
    await expect
      .poll(() => computed(page, "heading-1", "font-size"))
      .not.toBe("40px");
    await expectUndoAvailable(page, false);
  });
});

test.describe("Canvas, Preview, Export and Save see the same value", () => {
  test("a live edit is what Preview renders and Export generates", async ({
    page,
  }) => {
    await gotoApp(page);
    await selectOnCanvas(page, "heading-1");
    const field = await replaceText(page, "Font size", "44");
    await field.press("Enter");

    await page.getByRole("button", { name: "Enter Preview" }).click();
    await expect
      .poll(() => computed(page, "heading-1", "font-size"))
      .toBe("44px");
    await page.getByRole("button", { name: "Exit Preview" }).click();

    await page.getByRole("button", { name: "Export Code" }).click();
    const code = page
      .getByRole("dialog", { name: "Export Code" })
      .getByTestId("export-code");
    await expect(code).toContainText(/font-size:\s*44px/);
  });

  test("Ctrl+S mid-edit commits the edit, then saves it; the field keeps focus and the next edit starts fresh", async ({
    page,
  }) => {
    await gotoApp(page);
    const status = page.locator("[data-project-status]");
    await page.keyboard.press("Control+s");
    const dialog = page.getByRole("dialog", { name: "Save Project" });
    await dialog
      .getByRole("textbox", { name: "Project name" })
      .fill("Live edit save");
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(status).toHaveAttribute("data-project-status", "saved");

    await selectOnCanvas(page, "heading-1");
    const field = await replaceText(page, "Font size", "44");
    await expect
      .poll(() => computed(page, "heading-1", "font-size"))
      .toBe("44px");
    await page.keyboard.press("Control+s");
    await expect(status).toHaveAttribute("data-project-status", "saved");
    await expect(field).toBeFocused();

    const savedText = await page.evaluate(
      () =>
        new Promise<string>((resolve, reject) => {
          const request = indexedDB.open("layoutry-projects");
          request.onerror = () => reject(request.error);
          request.onsuccess = () => {
            const database = request.result;
            const all = database
              .transaction("documents")
              .objectStore("documents")
              .getAll();
            all.onsuccess = () => {
              database.close();
              resolve(
                all.result.map((entry: { text: string }) => entry.text).join(),
              );
            };
            all.onerror = () => reject(all.error);
          };
        }),
    );
    const savedHeading = JSON.parse(savedText).document.children[0].children[0];
    expect(savedHeading.id).toBe("heading-1");
    expect(savedHeading.typography.fontSize).toEqual({ value: 44, unit: "px" });

    // The save committed the edit: Escape now has nothing to cancel.
    await field.press("Escape");
    expect(await computed(page, "heading-1", "font-size")).toBe("44px");
    await expect(status).toHaveAttribute("data-project-status", "saved");

    // A new edit makes the project unsaved; cancelling it restores the
    // exact saved document, so the project is clean again.
    await replaceText(page, "Font size", "46");
    await expect(status).not.toHaveAttribute("data-project-status", "saved");
    await fontSizeField(page).press("Escape");
    expect(await computed(page, "heading-1", "font-size")).toBe("44px");
    await expect(status).toHaveAttribute("data-project-status", "saved");
    await expect(canvasNode(page, "heading-1")).toBeVisible();
  });
});
