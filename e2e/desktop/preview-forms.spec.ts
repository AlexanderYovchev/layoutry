import { expect, test, type Page } from "@playwright/test";
import type { EditorElementNode } from "../../src/features/editor/types/document";
import { serializeProject } from "../../src/features/project/utils/serializeProject";
import { launchLayoutry, type LaunchedLayoutry } from "./support/layoutryApp";

/**
 * BC-02.4 — B1 in the real Electron window: form controls work in
 * Preview, a form submission cannot navigate the app, Preview changes
 * never reach the document, and Design editing is unchanged.
 */

let layoutry: LaunchedLayoutry;

test.beforeEach(async () => {
  layoutry = await launchLayoutry();
});

test.afterEach(async () => {
  await layoutry?.dispose();
});

const formDocument: EditorElementNode = {
  id: "page-root",
  tag: "page",
  children: [
    {
      id: "form-1",
      tag: "form",
      children: [
        { id: "i-text", tag: "input", inputType: "text", value: "Ada" },
        {
          id: "label-check",
          tag: "label",
          children: [
            { id: "i-check", tag: "input", inputType: "checkbox" },
            { id: "label-text", tag: "p", text: "Subscribe" },
          ],
        },
        {
          id: "sel",
          tag: "select",
          children: [
            { id: "o-1", tag: "option", text: "Small", value: "s" },
            {
              id: "o-2",
              tag: "option",
              text: "Medium",
              value: "m",
              selected: true,
            },
            { id: "o-3", tag: "option", text: "Large", value: "l" },
          ],
        },
        { id: "t-area", tag: "textarea", value: "Hello" },
      ],
    },
  ],
};

const control = (page: Page, nodeId: string) =>
  page.locator(`[data-document-surface] [data-node-id="${nodeId}"]`);

test("form controls work in Preview, cannot navigate the app, and leave the document untouched", async () => {
  const { page } = layoutry;
  const file = serializeProject({
    metadata: {
      id: "00000000-0000-4000-8000-000000000242",
      name: "BC-02.4 forms",
      createdAt: "2026-11-05T00:00:00.000Z",
      updatedAt: "2026-11-05T00:00:00.000Z",
    },
    document: formDocument,
  });
  await page.getByTestId("project-import-input").setInputFiles({
    name: "forms.layoutry",
    mimeType: "application/json",
    buffer: Buffer.from(file),
  });
  await expect(control(page, "t-area")).toBeAttached({ timeout: 30_000 });
  const url = page.url();
  await page.evaluate(() => Reflect.set(window, "__bc024Marker", "intact"));

  // Design: a click selects; typing does nothing.
  await control(page, "i-text").click();
  await page.keyboard.type("zzz");
  await expect(control(page, "i-text")).toHaveValue("Ada");

  await page.getByRole("button", { name: "Enter Preview" }).click();
  await control(page, "i-text").click();
  await page.keyboard.press("End");
  await page.keyboard.type("XYZ");
  await expect(control(page, "i-text")).toHaveValue("AdaXYZ");
  // Implicit submission (Enter in the form's only text field) must not navigate.
  await page.keyboard.press("Enter");
  await page.getByText("Subscribe", { exact: true }).click();
  await expect(control(page, "i-check")).toBeChecked();
  await control(page, "sel").focus();
  await page.keyboard.press("ArrowDown");
  await expect(control(page, "sel")).toHaveValue("l");
  await control(page, "t-area").click();
  await page.keyboard.press("Control+End");
  await page.keyboard.type(" World");
  await expect(control(page, "t-area")).toHaveValue("Hello World");
  await page.waitForTimeout(500);
  expect(page.url()).toBe(url);
  expect(await page.evaluate(() => Reflect.get(window, "__bc024Marker"))).toBe(
    "intact",
  );

  await page.getByRole("button", { name: "Exit Preview" }).click();
  await expect(control(page, "i-text")).toHaveValue("Ada");
  await expect(control(page, "i-check")).not.toBeChecked();
  await expect(control(page, "sel")).toHaveValue("m");
  await expect(control(page, "t-area")).toHaveValue("Hello");
  await expect(
    page.getByRole("button", { name: "Undo", exact: true }),
  ).toBeDisabled();

  // Design editing still works: double-click, type, Enter commits one step.
  await control(page, "i-text").dblclick();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.type("Grace");
  await page.keyboard.press("Enter");
  await expect(control(page, "i-text")).toHaveValue("Grace");
  await expect(
    page.getByRole("button", { name: "Undo", exact: true }),
  ).toBeEnabled();
});
