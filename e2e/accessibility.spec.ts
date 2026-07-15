import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("home page has no automatically detectable accessibility violations", async ({
  page,
}) => {
  await page.goto("/");
  await page.waitForSelector("main");

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();

  expect(results.violations).toEqual([]);
});

test("Menu Bar dropdown has no accessibility violations while open", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("menuitem", { name: "File" }).click();
  await expect(page.getByRole("menu", { name: "File" })).toBeVisible();

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();

  expect(results.violations).toEqual([]);
});

test("Creation Toolbar catalog panel has no accessibility violations while open", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "HTML" }).click();
  await expect(page.getByRole("menu", { name: "HTML elements" })).toBeVisible();

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();

  expect(results.violations).toEqual([]);
});

test("About dialog has no accessibility violations while open", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("menuitem", { name: "Help" }).click();
  await page.getByRole("menuitem", { name: "About Layoutry" }).click();
  await expect(
    page.getByRole("dialog", { name: "About Layoutry" }),
  ).toBeVisible();

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();

  expect(results.violations).toEqual([]);
});

test("Structure tree has no accessibility violations", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("tab", { name: "Structure" }).click();
  await expect(
    page.getByRole("tree", { name: "Page structure" }),
  ).toBeVisible();

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();

  expect(results.violations).toEqual([]);
});

test("unsupported-viewport notice has no accessibility violations", async ({
  page,
}) => {
  await page.setViewportSize({ width: 800, height: 700 });
  await page.goto("/");
  await expect(
    page.getByText("Layoutry currently works best on a larger screen."),
  ).toBeVisible();

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();

  expect(results.violations).toEqual([]);
});
