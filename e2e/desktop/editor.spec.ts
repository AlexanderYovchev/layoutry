import { expect, test } from "@playwright/test";
import {
  documentNodeCount,
  dragInsertContainer,
  launchLayoutry,
  type LaunchedLayoutry,
} from "./support/layoutryApp";

let layoutry: LaunchedLayoutry;

test.beforeEach(async () => {
  layoutry = await launchLayoutry();
});

test.afterEach(async () => {
  await layoutry?.dispose();
});

test("selects a Canvas element and shows it in the Inspector", async () => {
  const { page } = layoutry;
  const inspector = page.getByRole("complementary", {
    name: "Inspector panel",
  });
  await expect(page.getByText("No element selected")).toBeVisible();

  await page.locator("[data-document-surface] h1").first().click();
  await expect(inspector.getByText("1 element selected")).toBeVisible();
  await expect(inspector.getByText("heading-1")).toBeVisible();
});

test("drag-inserts from the Resource library, then undoes and redoes it", async () => {
  const { page } = layoutry;
  const before = await documentNodeCount(page);

  await dragInsertContainer(page);
  await expect.poll(() => documentNodeCount(page)).toBe(before + 1);
  await expect(
    page
      .getByRole("complementary", { name: "Inspector panel" })
      .getByText("Container")
      .first(),
  ).toBeVisible();

  await page.keyboard.press("Control+z");
  await expect.poll(() => documentNodeCount(page)).toBe(before);

  await page.keyboard.press("Control+y");
  await expect.poll(() => documentNodeCount(page)).toBe(before + 1);
});

test("round-trips between Design and Preview", async () => {
  const { page } = layoutry;
  const status = page.getByRole("contentinfo", { name: "Status bar" });
  await expect(status).toContainText("Design mode");

  await page.getByRole("button", { name: "Enter Preview" }).click();
  await expect(status).toContainText("Preview mode");
  await expect(
    page.getByRole("button", { name: "Exit Preview" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Exit Preview" }).click();
  await expect(status).toContainText("Design mode");
});

test("swallows every reload shortcut, so unsaved work survives", async () => {
  const { page } = layoutry;
  const before = await documentNodeCount(page);
  await dragInsertContainer(page);
  await expect.poll(() => documentNodeCount(page)).toBe(before + 1);
  await page.evaluate(() => Reflect.set(window, "__notReloaded", true));

  for (const shortcut of [
    "F5",
    "Control+r",
    "Control+Shift+r",
    "Control+F5",
    "Shift+F5",
  ]) {
    await page.keyboard.press(shortcut);
    await page.waitForTimeout(300);
    expect(
      await page.evaluate(() => Reflect.get(window, "__notReloaded")),
      shortcut,
    ).toBe(true);
  }
  expect(await documentNodeCount(page)).toBe(before + 1);
});

test("keeps native text editing shortcuts inside inputs", async () => {
  const { page } = layoutry;
  await page.locator("[data-document-surface] h1").first().click();
  const idField = page
    .getByRole("complementary", { name: "Inspector panel" })
    .getByRole("textbox")
    .first();
  await idField.click();
  await page.keyboard.type("abc");
  await page.keyboard.press("Control+a");
  await page.keyboard.press("Control+c");
  await page.keyboard.press("End");
  await page.keyboard.press("Control+v");
  await expect(idField).toHaveValue("abcabc");
  await page.keyboard.press("Control+z");
  await expect(idField).toHaveValue("abc");
});
