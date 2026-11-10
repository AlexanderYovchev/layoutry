import { expect, test, type Page } from "@playwright/test";
import { launchLayoutry, type LaunchedLayoutry } from "./support/layoutryApp";

/**
 * BC-05.3 in the real Electron window, on the starter page: the button's
 * unset padding shows what it renders; an authored padding 0 is applied;
 * Reset brings the default padding back; Undo/Redo keep the distinction;
 * a one-side keyboard reset keeps focus on that side.
 */

let layoutry: LaunchedLayoutry | undefined;

test.afterEach(async () => {
  await layoutry?.dispose();
  layoutry = undefined;
});

const SIDES = ["top", "right", "bottom", "left"] as const;
const button = (page: Page) => page.locator('[data-document-surface] [data-node-id="button-1"]');
const inspector = (page: Page) => page.getByRole("complementary", { name: "Inspector panel" });
const padding = (page: Page) => button(page).evaluate((element, sides) => sides.map((side) => getComputedStyle(element).getPropertyValue(`padding-${side}`)), [...SIDES]);
const resetButton = (page: Page, name: string) => inspector(page).getByRole("button", { name, exact: true });

async function typeInto(page: Page, label: string, value: string, which: "first" | "last" = "first") {
  const fields = inspector(page).getByLabel(label, { exact: true });
  const field = which === "first" ? fields.first() : fields.last();
  await field.click();
  await field.press("Control+a");
  await page.keyboard.type(value);
  await page.keyboard.press("Enter");
}

test("authored padding 0, reset to the default, Undo/Redo and a keyboard side reset in the desktop app", async () => {
  layoutry = await launchLayoutry();
  const { page } = layoutry;
  await button(page).click({ position: { x: 5, y: 5 } });
  const defaultPadding = await padding(page);
  expect(defaultPadding).not.toEqual(["0px", "0px", "0px", "0px"]);
  await expect(resetButton(page, "Reset padding")).toBeDisabled();

  // One side: Left 0, the others keep the default.
  await typeInto(page, "Left", "0", "last");
  expect(await padding(page)).toEqual([defaultPadding[0], defaultPadding[1], defaultPadding[2], "0px"]);
  await expect(resetButton(page, "Reset padding left")).toBeEnabled();

  // Keyboard reset of that side: removed, focus stays on its field.
  await resetButton(page, "Reset padding left").focus();
  await page.keyboard.press("Enter");
  await expect(inspector(page).getByLabel("Left", { exact: true }).last()).toBeFocused();
  expect(await padding(page)).toEqual(defaultPadding);

  // All sides 0, then Reset, Undo, Redo.
  await inspector(page).getByRole("button", { name: "Unlinked", exact: true }).click();
  await typeInto(page, "Padding (all sides)", "0");
  expect(await padding(page)).toEqual(["0px", "0px", "0px", "0px"]);
  await resetButton(page, "Reset padding").click();
  expect(await padding(page)).toEqual(defaultPadding);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  expect(await padding(page)).toEqual(["0px", "0px", "0px", "0px"]);
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  expect(await padding(page)).toEqual(defaultPadding);
});
