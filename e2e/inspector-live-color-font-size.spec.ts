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
 * BC-01.4 — live color text editing and an accurate Font size display, in
 * a real browser: real typing, focus, caret and keyboard, checked against
 * the Canvas's computed styles. Fresh page per test (empty history), so
 * "one Undo restores AND Undo is then disabled" proves one entry.
 */

const textColorField = (page: Page) =>
  page.getByLabel("Text color", { exact: true });
const fontSizeField = (page: Page) =>
  page.getByLabel("Font size", { exact: true });

async function undo(page: Page) {
  // Ctrl+Z is deliberately ignored while focus is inside an input.
  await page.evaluate(() =>
    (document.activeElement as HTMLElement | null)?.blur(),
  );
  await page.keyboard.press("Control+z");
}

async function clearField(page: Page, label: string) {
  const field = page.getByLabel(label, { exact: true });
  await field.click();
  await field.press("Control+a");
  await field.press("Backspace");
  return field;
}

test.describe("live color text", () => {
  test.beforeEach(async ({ page }) => {
    await gotoApp(page);
    await selectOnCanvas(page, "heading-1");
  });

  test("each valid intermediate color previews before blur; one Enter is one entry; Undo/Redo", async ({
    page,
  }) => {
    const original = await computed(page, "heading-1", "color");
    const field = await clearField(page, "Text color");
    await page.keyboard.type("#ff");
    expect(await computed(page, "heading-1", "color")).toBe(original);
    await page.keyboard.type("0");
    await expect
      .poll(() => computed(page, "heading-1", "color"))
      .toBe("rgb(255, 255, 0)");
    await page.keyboard.type("000");
    await expect
      .poll(() => computed(page, "heading-1", "color"))
      .toBe("rgb(255, 0, 0)");
    await expect(field).toBeFocused();
    await expect(field).toHaveValue("#ff0000");

    await field.press("Enter");
    await undo(page);
    await expect
      .poll(() => computed(page, "heading-1", "color"))
      .toBe(original);
    await expect(field).toHaveValue("");
    await expectUndoAvailable(page, false);
    await page.keyboard.press("Control+Shift+z");
    await expect
      .poll(() => computed(page, "heading-1", "color"))
      .toBe("rgb(255, 0, 0)");
  });

  test("the caret stays put across live writes", async ({ page }) => {
    const field = await replaceText(page, "Text color", "rgb(1, 2, 3)");
    await expect
      .poll(() => computed(page, "heading-1", "color"))
      .toBe("rgb(1, 2, 3)");
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.type("4");
    await expect(field).toHaveValue("rgb(1, 2, 34)");
    await page.keyboard.type("5");
    await expect(field).toHaveValue("rgb(1, 2, 345)");
    // 345 still matches the editor's rgb() syntax rule, so it is written
    // live; the browser clamps the channel to 255 (existing validation).
    await expect
      .poll(() => computed(page, "heading-1", "color"))
      .toBe("rgb(1, 2, 255)");
    await expect(field).toBeFocused();
  });

  test("Escape restores the unset color and the field; no history", async ({
    page,
  }) => {
    const original = await computed(page, "heading-1", "color");
    const field = await replaceText(page, "Text color", "#00ff00");
    await expect
      .poll(() => computed(page, "heading-1", "color"))
      .toBe("rgb(0, 255, 0)");
    await field.press("Escape");

    await expect(field).toHaveValue("");
    expect(await computed(page, "heading-1", "color")).toBe(original);
    await expectUndoAvailable(page, false);
  });

  test("blur commits once; focus/blur without an edit records nothing", async ({
    page,
  }) => {
    const original = await computed(page, "heading-1", "color");
    const field = textColorField(page);
    await field.click();
    await clickInspectorChrome(page);
    await expectUndoAvailable(page, false);

    await replaceText(page, "Text color", "hsl(120, 100%, 25%)");
    await expect
      .poll(() => computed(page, "heading-1", "color"))
      .toBe("rgb(0, 128, 0)");
    await clickInspectorChrome(page);
    await undo(page);
    await expect
      .poll(() => computed(page, "heading-1", "color"))
      .toBe(original);
    await expectUndoAvailable(page, false);
  });

  test("an invalid final draft reverts the field and the Canvas, shows why, and records nothing", async ({
    page,
  }) => {
    const original = await computed(page, "heading-1", "color");
    const field = await replaceText(page, "Text color", "#ff0000");
    await expect
      .poll(() => computed(page, "heading-1", "color"))
      .toBe("rgb(255, 0, 0)");
    await page.keyboard.type("zz");
    await field.press("Enter");

    await expect(field).toHaveValue("");
    await expect
      .poll(() => computed(page, "heading-1", "color"))
      .toBe(original);
    await expect(
      page.getByText("Enter a hex color (#RRGGBB) or an rgb()/rgba() value."),
    ).toBeVisible();
    await expectUndoAvailable(page, false);
  });

  test("selecting another element mid-edit commits the color to the original element only", async ({
    page,
  }) => {
    const paragraphBefore = await computed(page, "paragraph-1", "color");
    await replaceText(page, "Text color", "#ff0000");
    await selectOnCanvas(page, "paragraph-1");

    await expect(textColorField(page)).toHaveValue("");
    expect(await computed(page, "heading-1", "color")).toBe("rgb(255, 0, 0)");
    expect(await computed(page, "paragraph-1", "color")).toBe(paragraphBefore);
  });

  test("the native picker still commits once, and a typed edit before it is its own entry", async ({
    page,
  }) => {
    const original = await computed(page, "heading-1", "color");
    await replaceText(page, "Text color", "#ff0000");
    // fill() on type=color dispatches input + change, as a confirmed pick does.
    await page.getByLabel("Choose text color", { exact: true }).fill("#00aa00");
    await expect
      .poll(() => computed(page, "heading-1", "color"))
      .toBe("rgb(0, 170, 0)");
    await expect(textColorField(page)).toHaveValue("#00aa00");

    await undo(page);
    await expect
      .poll(() => computed(page, "heading-1", "color"))
      .toBe("rgb(255, 0, 0)");
    await undo(page);
    await expect
      .poll(() => computed(page, "heading-1", "color"))
      .toBe(original);
    await expectUndoAvailable(page, false);
  });

  test("Background and Border color fields are live too", async ({ page }) => {
    await selectOnCanvas(page, "section-1");
    const background = await replaceText(page, "Background color", "#ffeeaa");
    await expect
      .poll(() => computed(page, "section-1", "background-color"))
      .toBe("rgb(255, 238, 170)");
    await expect(background).toBeFocused();
    await background.press("Enter");

    await selectOnCanvas(page, "button-1");
    const border = await replaceText(page, "Border color", "#ff0000");
    await expect
      .poll(() => computed(page, "button-1", "border-top-color"))
      .toBe("rgb(255, 0, 0)");
    await expect(border).toBeFocused();
  });

  test("Ctrl+S mid-edit commits the color and saves it", async ({ page }) => {
    const status = page.locator("[data-project-status]");
    await page.keyboard.press("Control+s");
    const dialog = page.getByRole("dialog", { name: "Save Project" });
    await dialog
      .getByRole("textbox", { name: "Project name" })
      .fill("Live color save");
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(status).toHaveAttribute("data-project-status", "saved");

    await selectOnCanvas(page, "heading-1");
    const field = await replaceText(page, "Text color", "#ff0000");
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
              resolve(all.result[0].text);
            };
            all.onerror = () => reject(all.error);
          };
        }),
    );
    const savedHeading = JSON.parse(savedText).document.children[0].children[0];
    expect(savedHeading.typography.color).toBe("#ff0000");
  });
});

test.describe("font size shows what the Canvas renders", () => {
  test("H1: shows 30 while unset; Arrow Up -> 31px, Arrow Down -> 29px; one Undo back to unset", async ({
    page,
  }) => {
    await gotoApp(page);
    await selectOnCanvas(page, "heading-1");
    const field = fontSizeField(page);
    expect(await computed(page, "heading-1", "font-size")).toBe("30px");
    await expect(field).toHaveValue("30");

    await field.click();
    await field.press("ArrowUp");
    await expect
      .poll(() => computed(page, "heading-1", "font-size"))
      .toBe("31px");
    await field.press("ArrowDown");
    await field.press("ArrowDown");
    await expect
      .poll(() => computed(page, "heading-1", "font-size"))
      .toBe("29px");
    await field.press("Enter");

    await undo(page);
    await expect
      .poll(() => computed(page, "heading-1", "font-size"))
      .toBe("30px");
    await expect(field).toHaveValue("30");
    await expectUndoAvailable(page, false);
  });

  test("focusing and leaving the unset field authors nothing", async ({
    page,
  }) => {
    await gotoApp(page);
    await selectOnCanvas(page, "heading-1");
    await fontSizeField(page).click();
    await clickInspectorChrome(page);
    await expectUndoAvailable(page, false);
  });

  test("every heading level, and other text elements, show their rendered size", async ({
    page,
  }) => {
    await gotoApp(page);
    await selectOnCanvas(page, "heading-1");
    for (const level of ["H2", "H3", "H4", "H5", "H6", "H1"]) {
      await page.getByRole("button", { name: level, exact: true }).click();
      const px = await computed(page, "heading-1", "font-size");
      await expect(fontSizeField(page)).toHaveValue(px.replace("px", ""));
    }
    for (const id of ["paragraph-1", "button-1"]) {
      await selectOnCanvas(page, id);
      const px = await computed(page, id, "font-size");
      await expect(fontSizeField(page)).toHaveValue(px.replace("px", ""));
    }
  });

  test("an option shows the size it inherits from its select, and follows a change to the select", async ({
    page,
  }) => {
    await gotoApp(page);
    await page.getByRole("button", { name: "Components" }).click();
    await page.getByRole("menuitem", { name: /^Labeled Select Field/ }).click();
    const optionId = await page
      .locator('[data-document-surface] [data-node-type="option"]')
      .first()
      .getAttribute("data-node-id");
    const selectId = await page
      .locator('[data-document-surface] [data-node-type="select"]')
      .first()
      .getAttribute("data-node-id");
    if (!optionId || !selectId) throw new Error("select field not inserted");

    await page.getByRole("tab", { name: "Structure" }).click();
    const tree = page.getByRole("tree", { name: "Page structure" });
    // The select's node starts collapsed, hiding its options.
    await tree.getByRole("button", { name: "Expand Select" }).click();
    await tree
      .getByRole("treeitem", { name: /Option/ })
      .first()
      .click();
    const inherited = await computed(page, optionId, "font-size");
    await expect(fontSizeField(page)).toHaveValue(inherited.replace("px", ""));

    await tree
      .getByRole("treeitem", { name: /Select/ })
      .first()
      .click();
    const field = await replaceText(page, "Font size", "22");
    await field.press("Enter");
    await tree
      .getByRole("treeitem", { name: /Option/ })
      .first()
      .click();
    expect(await computed(page, optionId, "font-size")).toBe("22px");
    await expect(fontSizeField(page)).toHaveValue("22");
  });

  test("Preview and Export match: an unset size exports no authored font-size; a stepped one exports it", async ({
    page,
  }) => {
    await gotoApp(page);
    await selectOnCanvas(page, "heading-1");
    await fontSizeField(page).click();
    await clickInspectorChrome(page);

    const exportCode = page
      .getByRole("dialog", { name: "Export Code" })
      .getByTestId("export-code");
    await page.getByRole("button", { name: "Export Code" }).click();
    await expect(exportCode).not.toContainText("font-size: 30px");
    await page.keyboard.press("Escape");

    await fontSizeField(page).click();
    await fontSizeField(page).press("ArrowUp");
    await fontSizeField(page).press("Enter");
    await page.getByRole("button", { name: "Enter Preview" }).click();
    await expect
      .poll(() => computed(page, "heading-1", "font-size"))
      .toBe("31px");
    await page.getByRole("button", { name: "Exit Preview" }).click();
    await page.getByRole("button", { name: "Export Code" }).click();
    await expect(exportCode).toContainText(/font-size:\s*31px/);
    await expect(canvasNode(page, "heading-1")).toBeVisible();
  });
});
