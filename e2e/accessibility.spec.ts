import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { gotoApp } from "./support/gotoApp";

test("home page has no automatically detectable accessibility violations", async ({
  page,
}) => {
  await gotoApp(page);
  await page.waitForSelector("main");

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();

  expect(results.violations).toEqual([]);
});

test("Menu Bar dropdown has no accessibility violations while open", async ({
  page,
}) => {
  await gotoApp(page);
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
  await gotoApp(page);
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
  await gotoApp(page);
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
  await gotoApp(page);
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
  await gotoApp(page);
  await expect(
    page.getByText("Layoutry currently works best on a larger screen."),
  ).toBeVisible();

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();

  expect(results.violations).toEqual([]);
});

// UI-1.7 regressions: Inspector caption contrast (zinc-400 captions failed
// AA in both themes) and the creation toolbar sitting outside any landmark.
// Runs every axe rule (not just WCAG tags) over the editor chrome with an
// element selected and every Inspector section open. The user's own page
// ([data-document-surface]) is excluded: its content is authored, not ours.
for (const colorScheme of ["light", "dark"] as const) {
  test(`editor chrome with the full Inspector open has no accessibility violations (${colorScheme})`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme });
    await gotoApp(page);
    await page.locator("[data-document-surface] h1").first().click();

    const inspector = page.getByRole("complementary", {
      name: "Inspector panel",
    });
    const collapsed = inspector.locator("h3 > button[aria-expanded=false]");
    for (let i = (await collapsed.count()) - 1; i >= 0; i--) {
      await collapsed.nth(i).click();
    }
    await page.mouse.move(0, 0);

    const results = await new AxeBuilder({ page })
      .exclude("[data-document-surface]")
      .analyze();

    expect(results.violations).toEqual([]);
  });
}
