import { expect, test, type Page } from "@playwright/test";
import { launchLayoutry, type LaunchedLayoutry } from "./support/layoutryApp";

/**
 * BC-05.2 in the real Electron window, on the starter page: a keyboard
 * reset keeps focus on the property's own field; a reset while typing is
 * one Undo step; resetting Rotate keeps Scale.
 */

let layoutry: LaunchedLayoutry | undefined;

test.afterEach(async () => {
  await layoutry?.dispose();
  layoutry = undefined;
});

const heading = (page: Page) => page.locator('[data-document-surface] [data-node-id="heading-1"]');
const inspector = (page: Page) => page.getByRole("complementary", { name: "Inspector panel" });
const style = (page: Page, property: string) => heading(page).evaluate((element, name) => getComputedStyle(element).getPropertyValue(name), property);
const undo = (page: Page) => page.getByRole("button", { name: "Undo", exact: true }).click();

async function openSection(page: Page, name: string) {
  const header = inspector(page).getByRole("button", { name, exact: true });
  if ((await header.getAttribute("aria-expanded")) !== "true") await header.click();
}

async function setField(page: Page, label: string, value: string) {
  const field = inspector(page).getByLabel(label, { exact: true });
  await field.click();
  await field.press("Control+a");
  await page.keyboard.type(value);
  await page.keyboard.press("Enter");
}

test("keyboard reset, reset while typing and per-field Transform reset in the desktop app", async () => {
  layoutry = await launchLayoutry();
  const { page } = layoutry;
  await heading(page).click({ position: { x: 5, y: 5 } });
  await openSection(page, "Typography");
  const fontSize = inspector(page).getByLabel("Font size", { exact: true });

  await setField(page, "Font size", "40");
  await fontSize.click();
  await fontSize.press("Control+a");
  await page.keyboard.type("55");
  expect(await style(page, "font-size")).toBe("55px");
  await inspector(page).getByRole("button", { name: "Reset font size" }).click();
  expect(await style(page, "font-size")).toBe("30px");
  await undo(page);
  expect(await style(page, "font-size"), "one Undo returns to the committed 40").toBe("40px");

  await inspector(page).getByRole("button", { name: "Reset font size" }).focus();
  await page.keyboard.press("Enter");
  await expect(fontSize).toBeFocused();
  expect(await style(page, "font-size")).toBe("30px");

  await openSection(page, "Transform");
  await setField(page, "Rotate", "15");
  await setField(page, "Scale", "2");
  await inspector(page).getByRole("button", { name: "Reset rotate" }).click();
  await expect(inspector(page).getByLabel("Scale", { exact: true })).toHaveValue("2");
  expect(await style(page, "transform")).toBe("matrix(2, 0, 0, 2, 0, 0)");
});
