import { expect, test } from "@playwright/test";

test("home page renders the application shell regions", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("banner", { name: "Application menu bar" }),
  ).toBeVisible();
  await expect(page.getByText("Layoutry")).toBeVisible();
  await expect(
    page.getByRole("toolbar", { name: "Creation toolbar" }),
  ).toBeVisible();
  await expect(
    page.getByRole("complementary", { name: "Resource panel" }),
  ).toBeVisible();
  await expect(page.getByRole("main", { name: "Workspace" })).toBeVisible();
  await expect(
    page.getByRole("complementary", { name: "Inspector panel" }),
  ).toBeVisible();
  await expect(page.getByText("No element selected")).toBeVisible();
  await expect(
    page.getByRole("contentinfo", { name: "Status bar" }),
  ).toBeVisible();
});
